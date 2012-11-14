var LibraryMono = {
  $Mono__deps: [],
  $Mono: {
    Domain: {
      ptr: 0xbeefbeef,
      id: 0,

      assemblyArray: [],
    },

    translateDomain: function(ptr) {
      if (ptr != Mono.Domain.ptr) {
	throw "Invalid domain " + ptr;
      }

      return Mono.Domain;
    },

    translateAssembly: function(domptr, assptr) {
      domain = Mono.translateDomain(domptr);
      return domain.assemblyArray[assptr-1];
    },

    endsWith: function(str, tail) {
      var k = str.indexOf(tail);
      if (k == -1)
	return false;
      return k == str.length - tail.length;
    },

    endsWithIgnoreCase: function(str, tail) {
      str = str.toLowerCase();
      tail = tail.toLowerCase();

      var k = str.indexOf(tail);
      if (k == -1)
	return false;
      return k == str.length - tail.length;
    },
  },

  mono_domain_get: function() {
    return Mono.Domain.ptr; /* MonoDomain* */
  },

  mono_domain_get_by_id: function(id) {
    if (id != 0)
      throw "non-0 domain id";

    return Mono.Domain.ptr;
  },

  mono_domain_get: function() {
    return Mono.Domain.ptr;
  },

  mono_jit_init: function(file) {
    // we're going to ignore file, since we already have our 'assembly' laoded via JSIL
    return Mono.Domain.ptr;
  },

  mono_domain_assembly_open: function(domain, name) {
    domain = Mono.translateDomain(domain);
    name = Pointer_stringify(name);

    var assemblyName = null;

    if (Mono.endsWithIgnoreCase(name, ".dll") || Mono.endsWithIgnoreCase(name, ".exe")) {
      assemblyName = name.substr(name, name.length - 4);
    } else if (contentManifest.hasOwnProperty(name)) {
      var manifest = contentManifest(name);
      for (var i = 0; i < manifest.length; ++i) {
	if (i[0] == 'Script') {
	  assemblyName = i[1];
	  break;
	}
      }
    }

    if (assemblyName == null) {
      JSIL.Host.Warning("mono_domain_assembly_open: couldn't find assembly for filename '" + name + "'");
      return 0;
    }

    var ass = JSIL.GetAssembly(assemblyName, true);
    if (ass == null) {
      JSIL.Host.Warning("mono_domain_assembly_open: couldn't open assembly with name '" + assemblyName + "'");
      return 0;
    }

    var k = domain.assemblyArray.indexOf(ass);
    if (k == -1) {
      domain.assemblyArray.push(ass);
      k = domain.assemblyArray.length - 1;
    }

    return k + 1;
  },

  mono_jit_exec: function(domptr, assptr, argc, argv) {
    var domain = Mono.translateDomain(domptr);
    var assembly = Mono.translateAssembly(domptr, assptr);

    if (!assembly.hasOwnProperty("__CallEntryPoint__")) {
      throw "assembly has no entry point";
    }

    var args = [];
    argc = argc || 0;
    for (var i = 0; i < argc; ++i) {
      args.push(Pointer_stringify(getValue(argv + i * 4, 'i32')));
    }

    assembly.__CallEntryPoint__(args);
  },

  mono_string_new: function(domainptr, stringptr) {
    var str = Pointer_stringify(stringptr);
    var addr = JSIL.TempRootNewObject(new JSIL.Variable(str));
    return addr;
  },

  mono_add_internal_call: function(name, method) { },

  mono_config_parse: function(filename) { },
  mono_config_parse_memory: function(buffer) { },
  mono_environment_exitcode_get: function() { return 0; },
  mono_jit_cleanup: function(domptr) { }
};

autoAddDeps(LibraryMono, '$Mono');
mergeInto(LibraryManager.library, LibraryMono);
