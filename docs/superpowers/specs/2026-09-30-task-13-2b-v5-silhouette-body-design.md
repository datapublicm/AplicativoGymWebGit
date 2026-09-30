# Task 13.2B-v5.0 — Reconstrucción anatómica guiada por siluetas

## Objetivo

Sustituir el generador anatómico basado en campos implícitos/metaballs de la línea v4.x por un generador de malla humana masculina guiado directamente por las siluetas frontal y lateral del mockup aprobado.

La meta es que la geometría visible reproduzca de forma mucho más fiel la anatomía y las proporciones del diseño aprobado, especialmente en hombros, brazos, piernas, cabeza, manos y short, sin buscar, comprar ni incorporar modelos 3D externos como geometría final.

## Contexto y decisión técnica

La iteración v4.3 fue técnicamente válida, con sus pruebas automáticas aprobadas, pero fue rechazada visualmente por estos problemas principales:

- hombros y brazos con apariencia tubular;
- piernas con poca anatomía;
- cabeza y manos demasiado básicas;
- short con apariencia artificial;
- mejora insuficiente de la silueta pese a varias iteraciones de parámetros.

La causa estructural es el enfoque de construcción por campos implícitos, elipsoides, cápsulas y uniones suaves. En v5.0 este enfoque deja de ser el constructor principal del cuerpo.

## Referencia visual

La fuente de verdad visual será el mockup masculino previamente aprobado, con vistas frontal y lateral. Cuando ambas imágenes estén disponibles en el entorno de trabajo, se utilizarán para extraer proporciones, landmarks y contornos.

Hasta que dichas imágenes estén disponibles como archivos utilizables, el pipeline debe poder desarrollarse y probarse con fixtures sintéticos de silueta, pero el GLB candidato final de v5.0 no podrá considerarse visualmente aprobado sin ejecutarse contra las referencias reales.

El perfil numérico de v4.x puede reutilizarse únicamente como referencia secundaria o fallback de pruebas; no será la fuente principal de forma.

## Principio de construcción

La anatomía se derivará en esta secuencia:

1. cargar y normalizar las vistas frontal y lateral;
2. localizar landmarks anatómicos compartidos;
3. extraer el contorno corporal de cada vista;
4. muestrear anchos y profundidades por altura;
5. construir secciones transversales anatómicas;
6. generar una cage corporal continua mediante lofting;
7. aplicar deformaciones anatómicas locales y asimetría frente/espalda;
8. generar cabeza, manos y pies simplificados pero anatómicos;
9. derivar el short a partir de la superficie de pelvis y muslos;
10. exportar el cuerpo y el short como nodos separados en GLB 2.0.

## Sistema de coordenadas y normalización

Las dos vistas se normalizarán sobre una altura corporal común entre planta y coronilla. Los landmarks verticales deberán coincidir entre ambas vistas antes de construir geometría.

La reconstrucción usará:

- eje X: izquierda/derecha;
- eje Y: vertical corporal;
- eje Z: profundidad anterior/posterior.

El origen y la escala final deberán mantenerse compatibles con el visor actual de AplicativoGym.

## Landmarks anatómicos mínimos

La extracción o configuración deberá contemplar, como mínimo:

- coronilla;
- frente/cejas como referencia opcional;
- mentón;
- base del cuello;
- acromion izquierdo y derecho;
- axila izquierda y derecha;
- codo izquierdo y derecho;
- muñeca izquierda y derecha;
- línea pectoral alta;
- máxima proyección pectoral;
- reborde costal;
- ombligo;
- cintura mínima;
- cresta ilíaca/cadera;
- entrepierna;
- máximo glúteo en perfil;
- rodilla izquierda y derecha;
- máximo gemelo;
- tobillo izquierdo y derecho;
- talón;
- planta.

Los landmarks podrán venir de detección automática, configuración declarativa o una combinación de ambas. La arquitectura no dependerá de un modelo de visión concreto.

## Secciones transversales

El torso y las extremidades no se construirán como cilindros o cápsulas independientes pegadas. La geometría principal se formará a partir de secciones ordenadas por altura.

Secciones mínimas del torso:

- coronilla;
- cráneo superior;
- mandíbula;
- cuello;
- clavículas;
- hombros;
- pectoral alto;
- pectoral máximo;
- costillas;
- abdomen superior;
- ombligo;
- cintura mínima;
- pelvis;
- glúteo alto;
- glúteo máximo;
- entrepierna.

Las secciones no serán elipses obligatorias. Cada sección podrá almacenar un perfil angular o una forma 2D deformable para modelar correctamente pecho, espalda, oblicuos, pelvis y glúteos.

## Profundidad anterior y posterior

La vista lateral deberá permitir separar explícitamente:

- profundidad anterior;
- profundidad posterior.

No se asumirá simetría frente/espalda. Esto es obligatorio para representar:

- proyección del pectoral;
- retracción abdominal;
- caja torácica;
- escápula/dorsal;
- curvatura lumbar;
- glúteos;
- cuádriceps/isquios;
- gemelo y tendón de Aquiles.

## Hombros y brazos

El hombro deberá integrarse al torso mediante una transición anatómica continua. No se permitirá que el brazo se genere como una cápsula uniforme.

Cada brazo tendrá, como mínimo, estaciones geométricas independientes para:

- deltoides;
- brazo proximal;
- masa de bíceps/tríceps;
- estrechamiento del codo;
- antebrazo proximal;
- antebrazo distal;
- muñeca;
- palma.

Los anchos frontal y lateral podrán variar de forma independiente a lo largo del brazo.

## Piernas

Cada pierna tendrá, como mínimo, estaciones para:

- cadera/glúteo;
- muslo proximal;
- máxima masa de cuádriceps/isquios;
- muslo distal;
- rodilla;
- pantorrilla proximal;
- máximo gemelo;
- tendón de Aquiles;
- tobillo;
- pie.

La masa de muslo y pantorrilla deberá guardar coherencia visual con el torso musculoso aprobado.

## Cabeza, manos y pies

### Cabeza

La cabeza seguirá siendo estilizada, pero deberá incluir como mínimo:

- cráneo;
- plano frontal;
- mandíbula;
- mentón;
- volumen posterior.

No se exige detalle facial fino en esta task.

### Manos

Cada mano deberá incluir:

- transición de muñeca;
- palma;
- volumen simplificado de dedos.

No se exige rig de dedos ni separación individual completa de falanges en v5.0.

### Pies

Cada pie deberá incluir:

- talón;
- arco;
- empeine;
- antepié.

## Short

El short será una malla separada derivada de la superficie corporal de pelvis y muslos, no una primitiva aproximada independiente.

Proceso esperado:

1. seleccionar la banda corporal correspondiente a cintura/pelvis;
2. generar una superficie exterior mediante offset controlado;
3. construir cintura y hem inferior;
4. separar aperturas de pierna izquierda y derecha;
5. mantener longitud corta para dejar visible la mayor parte del cuádriceps.

Nodo requerido:

- `clothes__shorts_male_v5`

## Cuerpo

Nodo requerido:

- `body__male_v5`

El cuerpo visible final deberá constituir una superficie continua principal. Las separaciones inevitables de manos/pies u otras piezas solo se aceptarán si el pipeline final las une o si no producen discontinuidades visuales perceptibles.

## Preparación para segmentación muscular

v5.0 no implementará todavía la activación interactiva de músculos, pero la topología deberá diseñarse para permitir segmentación posterior de, como mínimo:

- pectoralis;
- deltoid_anterior;
- deltoid_lateral;
- deltoid_posterior;
- biceps;
- triceps;
- forearm;
- abdominals;
- obliques;
- latissimus;
- trapezius;
- erector_spinae;
- gluteals;
- quadriceps;
- hamstrings;
- adductors;
- abductors;
- calves.

Para facilitar esa fase, las secciones y vértices podrán conservar etiquetas anatómicas internas aunque todavía no se exporten como nodos `muscle__*`.

## Arquitectura de software propuesta

El pipeline deberá dividir responsabilidades en módulos pequeños y verificables. La implementación detallada se definirá en el plan, pero conceptualmente existirán estos componentes:

1. `silhouette_input`: carga, escala, alineación y normalización de referencias;
2. `anatomical_landmarks`: landmarks y niveles verticales compartidos;
3. `silhouette_sampling`: ancho frontal y profundidad lateral por nivel;
4. `body_sections`: representación de secciones transversales;
5. `body_loft`: generación de cage y conectividad entre secciones;
6. `anatomical_refinement`: deformaciones locales de pecho, espalda, hombros, brazos, glúteos y piernas;
7. `extremity_detail`: cabeza, manos y pies simplificados;
8. `shorts_from_body`: derivación del short;
9. `male_v5_export`: materiales, nombres de nodos y exportación GLB;
10. `male_v5_preview`: renders de validación.

Ningún componente de v5.0 deberá depender de `implicit_body.py` para producir la geometría visible final.

## Compatibilidad y preservación de v4.x

Los archivos v4.x no se borrarán durante esta task. Se conservarán para trazabilidad y comparación.

v5.0 no deberá modificar la selección del modelo publicado en producción hasta que exista aprobación visual expresa.

La nueva rama deberá permitir comparar v4.3 y v5.0 sin alterar el comportamiento actual de la aplicación.

## Formato y rendimiento

- formato final: GLB 2.0;
- geometría triangulada al exportar;
- normales finitas y consistentes;
- sin N-gons en el artefacto final;
- escala compatible con el visor;
- presupuesto inicial objetivo: 20k–120k triángulos para cuerpo + short antes de futuras optimizaciones;
- evitar densidad innecesaria en zonas sin impacto visual;
- concentrar resolución en hombros, axilas, manos, pelvis, rodillas y otras transiciones complejas.

## Validación técnica

La suite deberá verificar como mínimo:

- normalización coherente de frontal y lateral;
- landmarks ordenados verticalmente;
- correspondencia de niveles entre vistas;
- secciones con ancho y profundidad positivos;
- continuidad de conectividad entre secciones;
- ausencia de NaN/Inf;
- malla corporal principal conectada;
- orientación coherente de caras y normales;
- bounds y escala compatibles con el visor;
- existencia de `body__male_v5`;
- existencia de `clothes__shorts_male_v5`;
- ausencia de dependencia de campos implícitos en el generador v5;
- reimportación correcta del GLB exportado;
- presupuesto razonable de triángulos.

## Validación visual

La aceptación visual tendrá prioridad sobre el simple cumplimiento técnico.

Se generarán desde el GLB real reimportado:

1. frontal;
2. 3/4 frontal;
3. lateral;
4. posterior;
5. comparativa con el mockup aprobado.

Criterios visuales obligatorios:

- hombros anchos y redondos, sin apariencia de esfera pegada;
- brazos con transición deltoides-bíceps/tríceps-codo-antebrazo;
- pecho con profundidad real;
- espalda con volumen propio;
- cintura atlética pero no extrema;
- pelvis y glúteos anatómicos;
- muslos con volumen suficiente;
- rodillas legibles;
- pantorrillas anatómicas;
- cabeza proporcionada;
- manos y pies aceptables para el nivel de detalle del proyecto;
- short integrado a pelvis y muslos, sin aspecto flotante o rígido.

## Criterio de aceptación

Task 13.2B-v5.0 solo podrá cerrarse cuando se cumplan ambas condiciones:

### Técnica

- todas las pruebas definidas para v5.0 pasan;
- GLB válido y reimportable;
- contrato de nodos, escala y geometría cumplido.

### Visual

- el usuario aprueba expresamente la comparación del GLB real contra el mockup aprobado.

Un resultado técnicamente válido pero visualmente insuficiente no se considera terminado.

## Fuera de alcance

- cuerpo femenino;
- rig definitivo;
- animaciones;
- activación interactiva de músculos;
- colores principal/secundario por ejercicio;
- catálogo de ejercicios;
- publicación en producción;
- compra o incorporación de modelos humanos externos como geometría final;
- detalle facial realista;
- dedos completamente articulados.

## Entregables esperados

1. pipeline reproducible de reconstrucción masculina v5;
2. `site/models/human-male-base-v5.glb`;
3. capturas frontal, 3/4, lateral y posterior del GLB real;
4. comparativa lado a lado contra las referencias aprobadas;
5. pruebas automatizadas del nuevo pipeline;
6. documentación de parámetros y landmarks utilizados;
7. evidencia explícita de que el generador v5 no utiliza `implicit_body.py` ni marching cubes como constructor del cuerpo visible.
