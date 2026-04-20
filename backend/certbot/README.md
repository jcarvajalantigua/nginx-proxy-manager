# Certbot dns-plugins

This file contains info about available Certbot DNS plugins.
This only works for plugins which use the standard argument structure, so:
--authenticator <plugin-name> --<plugin-name>-credentials <FILE> --<plugin-name>-propagation-seconds <number>

File Structure:

```json
{
  "cloudflare": {
    "display_name": "Name displayed to the user",
    "package_name": "Package name in PyPi repo",
    "version_requirement": "Optional package version requirements (e.g. ==1.3 or >=1.2,<2.0, see https://www.python.org/dev/peps/pep-0440/#version-specifiers)",
    "dependencies": "Additional dependencies, space separated (as you would pass it to pip install)",
    "credentials": "Template of the credentials file",
    "full_plugin_name": "The full plugin name as used in the commandline with certbot, e.g. 'dns-njalla'"
  },
  ...
}
```

---

## Diagramas Mermaid

### Vista general

```mermaid
flowchart TD
    Client["Usuario / navegador / operador"] --> Entry["Certbot dns-plugins"]
    Entry --> Runtime["Runtime local o productivo"]
    Runtime --> Config["configuracion / variables / secretos"]
    Runtime --> Logs["logs y verificacion"]
```

### Flujo de operacion

```mermaid
sequenceDiagram
    actor User as Usuario
    participant UI as Interfaz
    participant Service as Servicio
    participant Config as Configuracion
    participant Store as Persistencia

    User->>UI: Inicia flujo principal
    UI->>Service: Solicita accion o recurso
    Service->>Config: Carga entorno y reglas
    Service->>Store: Lee o escribe estado si aplica
    Store-->>Service: Resultado
    Service-->>UI: Respuesta procesada
    UI-->>User: Confirmacion, vista o error accionable
```
