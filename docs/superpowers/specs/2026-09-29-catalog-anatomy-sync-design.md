# AplicativoGym — Diseño de catálogo, anatomía extensible, sincronización e interfaz

Fecha: 2026-09-29
Estado: Diseño aprobado en conversación (Partes 1–8)
Repositorio: `datapublicm/AplicativoGymWebGit`

## 1. Objetivo

Evolucionar AplicativoGym desde el prototipo v0.4 hacia una arquitectura extensible que permita:

- catálogo inicial de aproximadamente 300–400 ejercicios normalizados;
- incorporación posterior de nuevos ejercicios sin recompilar la aplicación;
- anatomía jerárquica y extensible, con subdivisiones musculares;
- modelos visuales hombre y mujer con una misma semántica anatómica;
- ejercicios globales y personalizados;
- zonas musculares globales y personalizadas;
- relaciones ejercicio–músculo con roles, lateralidad e intensidad relativa;
- importación y conservación del historial personal procedente del Excel;
- sincronización entre web y futura APK mediante una misma cuenta;
- funcionamiento offline en Android con sincronización posterior;
- proveniencia, licencia, normalización y deduplicación de datos externos;
- continuidad visual con el mockup/web ya construido y aprobado.

El sistema no tomará el Excel personal ni un repositorio externo concreto como fuente única de verdad.

## 2. Continuidad del mockup/web actual

El mockup y la web v0.4 ya construidos se mantienen como **base visual y de interacción**. El rediseño arquitectónico no implica rehacer la interfaz desde cero.

Se conservarán, salvo mejora explícita posterior:

- layout general del visor 3D;
- buscador y filtros en el panel lateral/superior;
- tarjeta de detalle del ejercicio;
- interacción táctil y con mouse;
- giro automático inteligente del cuerpo;
- zoom manual;
- responsive móvil;
- estilo general limpio del prototipo publicado.

Sobre esa base se incorporarán gradualmente:

- selector Hombre / Mujer;
- siluetas 3D mejoradas;
- catálogo ampliado;
- nuevos filtros;
- pantallas de historial, gimnasios, anatomía, importación y administración.

La versión pública actual de GitHub Pages actúa como **referencia visual funcional** durante la evolución del producto.

## 3. Problemas del modelo actual

El prototipo contiene un conjunto reducido de ejercicios codificados como constantes y una anatomía fija de 18 zonas. Parte de los alias proceden del historial personal del usuario.

Esto limita el crecimiento porque:

1. el historial personal no representa el universo de ejercicios;
2. las 18 zonas musculares actuales son demasiado gruesas;
3. nuevos ejercicios pueden requerir combinaciones o subdivisiones hoy inexistentes;
4. hombre y mujer necesitan geometrías diferentes, pero la misma lógica anatómica;
5. el catálogo debe crecer sin modificar código;
6. etiquetas ambiguas como `Pectoral 1`, `Espalda 4` o `Pierna 3` no deben mapearse por adivinación.

## 4. Principios de diseño

1. **Datos, no constantes**: ejercicios, zonas, equipamiento, alias y relaciones serán datos persistentes.
2. **Identidad canónica estable**: cada entidad tendrá ID estable independientemente de idioma o alias.
3. **Separación global/personal**: catálogo universal e historial del usuario permanecen separados.
4. **Anatomía lógica única**: hombre y mujer comparten `muscle_zone_id`; solo cambia la geometría asociada.
5. **Jerarquía extensible**: una zona puede subdividirse sin invalidar ejercicios previos.
6. **Fallback visual**: una subzona sin mesh propio puede usar temporalmente el ancestro renderizable más cercano.
7. **No inventar equivalencias**: etiquetas ambiguas permanecen pendientes hasta ser identificadas.
8. **Proveniencia obligatoria**: todo dato importado conserva fuente, versión y licencia.
9. **Deduplicación prudente**: similitud de nombre no basta para fusionar ejercicios.
10. **Interfaz cotidiana simple**: las herramientas avanzadas de administración no entorpecen el registro diario.

---

# Parte 1 — Taxonomía muscular jerárquica y extensible

## 5. Modelo anatómico

La anatomía se modelará como árbol extensible. Ejemplo:

```text
Piernas
└── Cuádriceps
    ├── Recto femoral
    ├── Vasto lateral
    ├── Vasto medial
    └── Vasto intermedio
```

Otro ejemplo:

```text
Hombros
└── Deltoides
    ├── Anterior
    ├── Lateral
    └── Posterior
```

La jerarquía podrá representar región, grupo, músculo, cabeza, porción o subzona funcional.

### 5.1 Entidad `muscle_zone`

Campos mínimos:

- `id`
- `slug`
- `name_es`
- `name_en`
- `parent_id`
- `level`
- `body_region`
- `zone_type`
- `scope` (`global` / `personal`)
- `owner_user_id` cuando corresponda
- `is_custom`
- `is_active`
- `review_status`

### 5.2 Geometría por sexo visual

La anatomía lógica es única:

```text
muscle_zone_id
├── anatomical_map_male
└── anatomical_map_female
```

No se duplican ejercicios ni músculos al cambiar de cuerpo.

### 5.3 Fallback anatómico

Si una zona no tiene delimitación 3D propia:

```text
subzona sin mesh
→ padre anatómico
→ ancestro renderizable más cercano
```

Ejemplo: `Cabeza lateral del tríceps` puede usar temporalmente `Tríceps` completo.

---

# Parte 2 — Catálogo universal normalizado y extensible

## 6. Catálogo inicial

Se cargará una selección inicial de aproximadamente **300–400 ejercicios normalizados**, no una lista cerrada.

Cada ejercicio tendrá como mínimo:

- `exercise_id`
- `name_es`
- `name_en`
- `aliases[]`
- `category`
- `movement_pattern`
- `mechanic`
- `force`
- `equipment[]`
- `difficulty`
- `unilateral_bilateral`
- `preferred_view`
- `instructions[]`
- `variation_group_id`
- `source`
- `scope`
- `is_custom`
- `is_active`

### 6.1 Variaciones

Ejercicios semejantes se agrupan por familia sin fusionarse indebidamente.

Ejemplo:

- Press banca con barra
- Press banca con mancuernas
- Chest press en máquina
- Press inclinado

Todos pueden pertenecer a una familia relacionada, pero conservar identidades propias.

### 6.2 Ejercicios personalizados

El usuario podrá crear ejercicios que no existan en el catálogo global y asignarles:

- nombre;
- categoría;
- equipamiento;
- patrón;
- músculos;
- lateralidad;
- instrucciones;
- grupo de variación.

---

# Parte 3 — Zonas globales y personalizadas

## 7. Alcance de las zonas

Existirán:

- **zonas globales**, validadas y compartidas;
- **zonas personales**, creadas por un usuario.

Una zona personal podrá posteriormente promoverse a global si se revisa y valida.

### 7.1 Editor anatómico

Se prevé una sección administrativa que permita:

- crear músculo;
- crear subdivisión;
- cambiar jerarquía;
- crear alias;
- desactivar una zona;
- verificar mapa masculino;
- verificar mapa femenino.

### 7.2 Editor visual 3D posterior

En una fase posterior se podrá permitir:

```text
Modelo hombre/mujer
→ seleccionar superficie
→ pintar/delimitar área
→ asociar a muscle_zone_id
```

Este editor visual no es requisito para la primera migración del catálogo.

---

# Parte 4 — Relación ejercicio ↔ músculos

## 8. Entidad `exercise_muscle`

La relación no se limitará a principal/secundario.

Campos mínimos:

- `exercise_id`
- `muscle_zone_id`
- `role`
- `activation_weight`
- `side`
- `notes`
- `source`

### 8.1 Roles musculares

Valores previstos:

- `primary`
- `secondary`
- `tertiary`
- `stabilizer`

### 8.2 Intensidad relativa

`activation_weight` será un valor relativo útil para orden y visualización. No se presentará necesariamente como porcentaje fisiológico exacto.

### 8.3 Lateralidad

Valores:

- `bilateral`
- `left`
- `right`
- `alternating`

Esto permitirá resaltar únicamente el lado correspondiente cuando aplique.

### 8.4 Representación visual

Propuesta inicial:

- principal: rojo intenso;
- secundario: ámbar/naranja;
- terciario: amarillo tenue;
- estabilizador: tono o contorno discreto.

---

# Parte 5 — Fuentes, normalización y deduplicación

## 9. Modelo canónico propio

AplicativoGym mantendrá su propio modelo canónico. Repositorios externos se usarán como fuentes de datos y referencia, no como estructura interna obligatoria.

Fuentes de referencia identificadas:

- Open ExerciseDB;
- Free Exercise DB;
- wger como referencia estructural;
- datos propios de AplicativoGym;
- historial Excel del usuario.

## 10. Proveniencia

Cada registro importado conservará:

- `source_type`
- `source_name`
- `source_external_id`
- `source_url`
- `source_license`
- `source_version`
- `imported_at`
- `review_status`

## 11. Normalización

Ejemplos:

```text
dumbbell / dumbbells / mancuerna / mancuernas
→ equipment_id = dumbbell
```

```text
bíceps / biceps / biceps brachii
→ muscle_zone_id = biceps_brachii
```

## 12. Deduplicación

Para posibles duplicados se compararán, al menos:

- nombre;
- equipamiento;
- patrón de movimiento;
- músculos;
- posición corporal;
- lateralidad;
- resistencia;
- variación.

Los casos dudosos quedarán pendientes de revisión, no se fusionarán automáticamente.

## 13. Estados de calidad

- `draft`
- `pending_review`
- `validated`
- `deprecated`

---

# Parte 6 — Backend, cuentas y sincronización

## 14. Tecnología base propuesta

Backend común para web y Android mediante **Supabase + PostgreSQL**.

Motivos:

- modelo fuertemente relacional;
- autenticación;
- Row Level Security;
- API;
- almacenamiento;
- buena compatibilidad con web y móvil.

## 15. Separación de datos

### Catálogo global

- exercises
- exercise_aliases
- exercise_variations
- muscle_zones
- exercise_muscles
- equipment
- sources

### Datos del usuario

- user_exercises
- user_muscle_zones
- user_aliases
- workout_sessions
- workout_sets
- gyms
- gym_locations
- gym_equipment_instances

## 16. Cuenta compartida

La misma cuenta funcionará en web y APK.

```text
Web ↔ Backend ↔ Android
```

## 17. Offline en Android

La APK deberá admitir registro local sin conexión y sincronización posterior.

Se requiere estrategia de:

- cache/base local;
- cola de cambios pendientes;
- sincronización;
- resolución de conflictos.

## 18. Seguridad

Los datos personales usarán `user_id` y políticas de acceso para impedir lectura cruzada entre usuarios.

---

# Parte 7 — Importación del Excel y administración

## 19. Importador inteligente

Flujo:

```text
Excel
→ normalización
→ buscar coincidencia canónica
→ coincidencia segura / probable / sin identificar
```

### 19.1 Reglas

- coincidencia segura: vinculación automática;
- probable: revisión del usuario;
- desconocida: permanece sin mapear o se crea como ejercicio personal;
- nunca se adivinan equivalencias ambiguas.

Ejemplo:

`Shoulder press` puede vincularse a un ejercicio conocido.

`Pectoral 1` no se mapeará hasta conocer la máquina/movimiento real.

## 20. Reglas reutilizables de mapeo

El usuario podrá definir equivalencias condicionadas por gimnasio/sede/máquina para futuras importaciones.

## 21. Historial estructurado

Modelo conceptual:

```text
workout_session
├── fecha
├── gimnasio
├── sede
└── ejercicios
    └── series
```

Cada serie podrá registrar:

- peso;
- repeticiones;
- lado;
- subdivisión;
- orden;
- RIR;
- RPE;
- duración;
- distancia;
- notas.

## 22. Subseries y técnicas

Se conservará la lógica del usuario para:

- derecha/izquierda;
- Sub1…SubX;
- drop sets;
- rest-pause;
- superseries;
- parciales.

La estructura podrá usar `parent_set_id` y `subseries_index`.

## 23. Máquinas por gimnasio

Se distinguirá entre:

- tipo de equipo universal;
- instancia real de una máquina en un gimnasio/sede.

Ejemplo:

```text
Smart Fit Brasil
└── Pectoral 1
    → vinculado a exercise_id canónico
```

Esto permite conservar la nomenclatura personal sin contaminar el catálogo universal.

---

# Parte 8 — Interfaz funcional Web / APK

## 24. Navegación principal

Secciones previstas:

- Entrenar
- Ejercicios
- Historial
- Gimnasios
- Anatomía
- Configuración

La versión móvil puede usar navegación inferior; la web puede usar navegación lateral.

## 25. Pantalla Entrenar

Mantendrá el mockup actual como base e incorporará:

- buscador;
- selector Hombre / Mujer;
- visor 3D;
- músculos resaltados;
- detalle del ejercicio;
- inicio de sesión de entrenamiento;
- registro de series.

## 26. Modelos hombre y mujer

Ambos usarán una pose neutra funcional y una silueta fitness más limpia que el modelo actual.

Requisitos:

- misma anatomía lógica;
- mapas 3D equivalentes;
- cambio de cuerpo sin cambiar el ejercicio seleccionado;
- conservación de giro automático y controles manuales.

## 27. Catálogo

Filtros previstos:

- grupo muscular;
- equipamiento;
- patrón;
- nivel;
- tipo;
- lateralidad;
- origen.

La búsqueda abarcará:

- nombre ES;
- nombre EN;
- alias;
- músculo;
- subdivisión;
- equipo;
- categoría;
- patrón.

## 28. Mis ejercicios

Se distinguirá visualmente:

- global;
- personal;
- vinculado al catálogo;
- sin identificar.

## 29. Historial

Filtros previstos:

- fecha;
- gimnasio;
- sede;
- grupo muscular;
- ejercicio;
- máquina.

Fases posteriores podrán incorporar progresión, volumen, frecuencia y mejores marcas.

## 30. Anatomía

Pantalla jerárquica para visualizar y administrar regiones, músculos y subdivisiones.

## 31. Gimnasios

Administración de gimnasios, sedes y máquinas reales vinculadas a ejercicios canónicos.

## 32. Importar Excel

Pantalla de resumen con:

- filas detectadas;
- coincidencias seguras;
- coincidencias probables;
- filas sin identificar;
- flujo de revisión.

---

# 33. Compatibilidad con el prototipo actual

La migración debe ser incremental.

El prototipo actual seguirá funcionando mientras se sustituye progresivamente:

- `EXERCISES` estático → repositorio/API de catálogo;
- 18 IDs musculares fijos → taxonomía jerárquica;
- aliases embebidos → tabla de aliases;
- historial externo → entidades de entrenamiento;
- modelo único → modelos hombre/mujer.

No se eliminará una función ya operativa sin que exista reemplazo funcional probado.

# 34. Fuera de alcance inmediato

No forman parte de la primera implementación del nuevo dominio:

- editor gráfico completo para pintar zonas directamente sobre el mesh 3D;
- analítica avanzada de rendimiento;
- recomendaciones automáticas de rutina;
- marketplace o contenido social;
- automatización de validación científica de activación muscular.

Estas funciones quedan habilitadas por la arquitectura, pero no son requisito inicial.

# 35. Criterios de aceptación del diseño

El diseño será considerado correctamente implementado cuando:

1. el catálogo pueda crecer sin editar constantes del frontend;
2. un ejercicio pueda asociarse a cualquier combinación de zonas musculares;
3. puedan añadirse subdivisiones anatómicas sin romper datos previos;
4. hombre y mujer compartan el mismo `muscle_zone_id`;
5. exista fallback cuando una subzona no tenga mesh propio;
6. datos globales y personales estén separados;
7. el historial Excel pueda importarse sin perder nombres originales;
8. etiquetas ambiguas puedan quedar pendientes sin equivalencia forzada;
9. web y APK puedan compartir cuenta y datos;
10. Android pueda registrar offline y sincronizar después;
11. cada dato externo conserve fuente/licencia;
12. el mockup/web actual siga siendo la referencia visual base durante la migración.

# 36. Próximo paso

Tras la revisión y aprobación de este documento, se deberá crear el plan de implementación por fases. Debido al alcance, el plan debe dividirse en entregables independientes y verificables, evitando intentar backend, catálogo, anatomía, modelos 3D, importador y APK en una sola entrega.