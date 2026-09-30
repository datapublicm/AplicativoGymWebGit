# Task 13.2C — Selección y preparación de Basemesh Anatómica Masculina

## Asset seleccionado

**MakeHuman hm08 base mesh**, fijado al commit `1f508f6083b2f823dab15de924b3bde72e08d77c` (v1.3.0).

- Ruta upstream: makehuman/data/3dobjs/base.obj
- SHA-256: 8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c
- Uso: topología anatómica base para el modelo masculino.
- Preparación: conservar exclusivamente el grupo corporal, eliminar geometría auxiliar/joints, verificar conectividad y exportar a GLB.

## Licencia

La documentación oficial de MakeHuman establece que sus assets gráficos, incluido el base mesh, están bajo CC0 1.0. El código fuente de MakeHuman tiene una licencia distinta; este proyecto utiliza el asset gráfico, no el código fuente de la aplicación.

## Decisión técnica

Esta basemesh **no es todavía el modelo masculino final**. Será la superficie anatómica inicial sobre la que se aplicará:

1. deformación por silueta frontal;
2. deformación por silueta lateral;
3. ajuste de proporciones del mockup aprobado;
4. posteriormente, delimitación muscular.

## Criterio de rechazo

No se aceptará una basemesh procedimental basada en tubos, metaballs o primitivas como sustituto de esta topología.