EMCC ?= emcc
CSC ?= csc
JSILC ?= jsilc

all: test.js test-native.js
	echo Done, run via: js -f run-test.js

test.exe: test.cs
	@echo ==== compiling test.exe from test.cs
	$(CSC) test.cs

test.js: test.exe
	@echo ==== compiling test.js from test.exe
	$(JSILC) test.exe

test-native.js: test-native.c mono.h library_mono.js
	@echo ==== compiling test-native.js from test-native.c
	$(EMCC) -o test-native.js test-native.c --js-library library_mono.js

clean:
	rm -f test-native.js test.js test.exe test.exe.manifest.js mscorlib,\ Version=* test,\ Version=*
