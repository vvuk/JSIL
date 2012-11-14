#include <stdlib.h>
#include <stdint.h>

#ifdef __cplusplus__
#define CPP_START extern "C" {
#define CPP_END }
#else
#define CPP_START /**/
#define CPP_END /**/
#endif

CPP_START

/* Note: any MonoObjects are going to be direct integers, and not
 * pointers to the emscripten heap.
 */
typedef struct { int unused; } MonoObject;
typedef MonoObject MonoArray;
typedef MonoObject MonoString;
typedef MonoObject MonoDomain;
typedef MonoObject MonoAssembly;

MonoDomain* mono_domain_get ();
MonoDomain* mono_domain_get_by_id (int32_t domainid);
MonoAssembly* mono_domain_assembly_open (MonoDomain *domain, const char *name);

MonoString* mono_string_new(MonoDomain *domain, const char *text);

void mono_config_parse (const char *filename);
void mono_config_parse_memory (const char *buffer);
int mono_environment_exitcode_get ();

void mono_add_internal_call (const char *name, const void *method);

MonoDomain* mono_jit_init (const char *file);
int mono_jit_exec (MonoDomain *domain, MonoAssembly *assembly, int argc, char *argv[]);
void mono_jit_cleanup (MonoDomain *domain);

CPP_END

