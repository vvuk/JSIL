﻿using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading;

namespace JSIL.Tests {
    public class EvaluatorPool : IDisposable {
        public const int Capacity = 4;

        public readonly string JSShellPath;
        public readonly string Options;
        public readonly Action<Evaluator> Initializer;

        private readonly ConcurrentBag<Evaluator> Evaluators = new ConcurrentBag<Evaluator>();
        private readonly AutoResetEvent EvaluatorReadySignal = new AutoResetEvent(false);
        private readonly AutoResetEvent WakeSignal = new AutoResetEvent(false);
        private readonly Thread PoolManager;

        private volatile int IsDisposed = 0;

        public EvaluatorPool (string jsShellPath, string options, Action<Evaluator> initializer) {
            JSShellPath = jsShellPath;
            Options = options;
            Initializer = initializer;

            PoolManager = new Thread(ThreadProc);
            PoolManager.Priority = ThreadPriority.AboveNormal;
            PoolManager.IsBackground = true;
            PoolManager.Name = "Evaluator Pool Manager";
            PoolManager.Start();
        }

        ~EvaluatorPool () {
            Dispose();
        }

        public void Dispose () {
            if (Interlocked.CompareExchange(ref IsDisposed, 1, 0) != 0)
                return;

            GC.SuppressFinalize(this);

            // The pool manager might dispose the signal before we get to it.
            try {
                WakeSignal.Set();
            } catch {
            }

            if (!PoolManager.Join(100))
                throw new Exception("Pool manager thread hung");
        }

        public Evaluator Get () {
            Evaluator result;

            var started = DateTime.UtcNow.Ticks;

            while (!Evaluators.TryTake(out result)) {
                WakeSignal.Set();
                EvaluatorReadySignal.WaitOne();
            }

            WakeSignal.Set();

            var ended = DateTime.UtcNow.Ticks;
            // Console.WriteLine("Took {0:0000}ms to get an evaluator", TimeSpan.FromTicks(ended - started).TotalMilliseconds);

            return result;
        }

        private Evaluator CreateEvaluator () {
            var result = new Evaluator(
                JSShellPath, Options
            );

            Initializer(result);

            return result;
        }

        private void ThreadProc () {
            try {
                while (IsDisposed == 0) {
                    while (Evaluators.Count < Capacity)
                        Evaluators.Add(CreateEvaluator());

                    EvaluatorReadySignal.Set();
                    WakeSignal.WaitOne();
                }
            } finally {
                EvaluatorReadySignal.Dispose();
                WakeSignal.Dispose();

                Evaluator evaluator;
                while (Evaluators.TryTake(out evaluator)) {
                    evaluator.Dispose();
                }
            }
        }
    }

    public class Evaluator : IDisposable {
        public const bool TraceInput = false;
        public const bool TraceOutput = false;

        public readonly Process Process;
        public readonly int Id;

        private static int NextId = 0;

        private volatile int InputClosed = 0;
        private volatile int IsDisposed = 0;
        private volatile int _ExitCode = 0;
        private volatile string _StdOut = null, _StdErr = null;
        private Action _JoinImpl;

        public Evaluator (string jsShellPath, string options) {
            Id = Interlocked.Increment(ref NextId);

            var psi = new ProcessStartInfo(
                jsShellPath, options
            ) {
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            ManualResetEventSlim stdoutSignal, stderrSignal;
            stdoutSignal = new ManualResetEventSlim(false);
            stderrSignal = new ManualResetEventSlim(false);

            Process = Process.Start(psi);

            ThreadPool.QueueUserWorkItem((_) => {
                try {
                    _StdOut = Process.StandardOutput.ReadToEnd();
                } catch {
                }
                stdoutSignal.Set();
            });
            ThreadPool.QueueUserWorkItem((_) => {
                try {
                    _StdErr = Process.StandardError.ReadToEnd();
                } catch {
                }
                stderrSignal.Set();
            });

            _JoinImpl = () => {
                stdoutSignal.Wait();
                stderrSignal.Wait();
                stderrSignal.Dispose();
                stderrSignal.Dispose();
            };
        }

        /// <summary>
        /// Not available until process has exited.
        /// </summary>
        public string StandardOutput {
            get {
                return _StdOut;
            }
        }

        /// <summary>
        /// Not available until process has exited.
        /// </summary>
        public string StandardError {
            get {
                return _StdErr;
            }
        }

        public int ExitCode {
            get {
                return _ExitCode;
            }
        }

        public void WriteInput (string text) {
            if (IsDisposed != 0)
                throw new ObjectDisposedException("evaluator");

            if (InputClosed != 0)
                throw new InvalidOperationException("Input stream already closed");

            if (TraceInput) {
                foreach (var line in text.Split(new [] { Environment.NewLine }, StringSplitOptions.None))
                    Debug.WriteLine("{0:X2} in : {1}", Id, line);
            }

            Process.StandardInput.Write(text);
            Process.StandardInput.Flush();
        }

        public void WriteInput (string format, params object[] args) {
            WriteInput(String.Format(format, args));
        }

        public void CloseInput () {
            if (IsDisposed != 0)
                throw new ObjectDisposedException("evaluator");

            if (Interlocked.CompareExchange(ref InputClosed, 1, 0) != 0)
                return;

            Process.StandardInput.Flush();
            Process.StandardInput.Close();
        }

        public void Join () {
            if (IsDisposed != 0)
                throw new ObjectDisposedException("evaluator");

            CloseInput();

            _JoinImpl();
            Process.WaitForExit();
            _ExitCode = Process.ExitCode;

            if (TraceOutput) {
                Debug.WriteLine("{0:X2} exit {1}", Id, _ExitCode);

                foreach (var line in _StdOut.Split(new[] { Environment.NewLine }, StringSplitOptions.None))
                    Debug.WriteLine("{0:X2} out: {1}", Id, line);

                foreach (var line in _StdErr.Split(new[] { Environment.NewLine }, StringSplitOptions.None))
                    Debug.WriteLine("{0:X2} err: {1}", Id, line);
            }
        }

        public void Dispose () {
            if (Interlocked.CompareExchange(ref IsDisposed, 1, 0) != 0)
                return;

            // The Process class likes to throw exceptions randomly in accessors and method calls.
            try {
                if (!Process.HasExited) {
                    Process.WaitForExit(1);
                    Process.Kill();
                } else
                    _ExitCode = Process.ExitCode;
            } catch {
            }

            try {
                Process.Close();
            } catch {
            }
        }
    }
}
