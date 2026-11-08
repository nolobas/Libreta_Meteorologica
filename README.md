# Libreta Meteorológica

Programa para Windows 10 y 11 que reemplaza a la antigua **LIBRETA** de MS-DOS usada en estaciones meteorológicas de superficie. Permite ingresar las observaciones horarias y genera automáticamente el mensaje **SYNOP** (FM 12, con los grupos nacionales de la sección 555).

Se distribuye gratis, con licencia libre **MIT**.

## Funciones

| Menú | Qué hace |
|---|---|
| **Libreta de observaciones** | Ingreso de presión, psicrómetro, extremas, viento, nubes, tiempo presente y pasado, visibilidad, precipitación y datos diarios. Calcula presión en la estación y al nivel del mar, tendencia, punto de rocío, humedad, tensión de vapor y sensación térmica. Arma el SYNOP mientras se escribe y controla la coherencia de los datos. |
| **Registradores** | Valores horarios de termógrafo, higrógrafo, barógrafo y heliofanógrafo; heliofanía efectiva, teórica y relativa; fenómenos del día. |
| **Visualización** | Datos para el público, datos sinópticos, una observación, búsqueda de SYNOP, último SYNOP y resumen mensual (exportable a Excel). |
| **Datos de la estación** | Identificación, ubicación, correcciones del instrumental y límites de control. |
| **Configuración del sistema** | Instrumental disponible, unidades, horarios y clave de acceso opcional. |
| **Administración** | Respaldos (.zip), archivos para enviar al SMN, formato `.SYN` del programa anterior, importación de datos de la LIBRETA de MS-DOS. |

## Descarga e instalación

En la sección **Releases** de este repositorio:

- **LibretaMeteorologica-…-Windows.zip**: no requiere instalación. Descomprimir (clic derecho → *Extraer todo*) y abrir `LibretaMeteorologica.exe`.
- **LibretaMeteorologica-…-Instalador.exe**: instala el programa con acceso directo en el escritorio.

Los datos se guardan en *Documentos\Libreta Meteorológica*.

## Para desarrolladores

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm start          # abre el programa
npm test           # pruebas de los cálculos
npm run dist       # arma el instalador para Windows (en dist/)
```

La compilación oficial y la firma digital se hacen automáticamente con GitHub Actions (`.github/workflows/build.yml`) al publicar una etiqueta de versión, por ejemplo `v2.0.1`.

Las pruebas `test/roundtrip.mjs` y `test/synfile.mjs` usan los archivos de datos de una LIBRETA de MS-DOS, que no se incluyen en el repositorio.

## Firma de código

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

Ver la [política de firma de código](CODE_SIGNING_POLICY.md).

## Privacidad

El programa no envía datos a ningún servidor. Toda la información queda en la computadora donde se usa.

## Licencia

[MIT](LICENSE)
