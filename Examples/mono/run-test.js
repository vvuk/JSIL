var jsilConfig = {
  runInShell: true,
  libraryRoot: "c:/proj/jsil/Libraries/",
  manifests: ["test.exe"],
  mono: true
};

run(jsilConfig.libraryRoot + "JSIL.js");
new JSIL.GetAssembly("test").MonoEmbed;

var Module = {
  arguments: ["test.exe"]
};

run("test-native.js");

JSIL.DumpObjectRootStats();
print("Done.\n");
