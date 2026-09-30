# Task 13.2B-v4.1 — Base masculina 3D propia

## Objetivo
Construir una nueva geometría 3D masculina propia para AplicativoGym tomando como única referencia visual el mockup masculino previamente aprobado por el usuario. Esta task no rediseña el personaje: traduce el diseño aprobado a una malla 3D base utilizable en web/APK.

## Referencia congelada
Archivo visual aprobado: `presentación_de_modelo_fitness_masculino.png`.

Se consideran bloqueados y no pueden alterarse sin aprobación expresa:
- alta masa muscular atlética;
- pecho voluminoso y definido;
- hombros anchos y redondos;
- brazos gruesos;
- espalda ancha;
- cintura atlética, sin exagerar la forma en V;
- cuádriceps y pantorrillas desarrollados;
- short negro corto;
- estilo 3D semirrealista premium.

## Alcance de esta task
Crear únicamente el cuerpo masculino base y el short como geometría real. Todavía no se realiza segmentación muscular funcional, coloreado por ejercicio, rig definitivo ni integración al visor publicado.

## Método de construcción
La malla visible será propia y no se obtendrá mediante nuevas deformaciones extremas del MakeHuman actual.

El cuerpo se construirá por volúmenes anatómicos controlados y luego se fusionará/suavizará para formar una malla continua. La primera versión prioriza silueta y masa muscular sobre detalle fino.

Volúmenes mínimos a modelar:
- cabeza y cuello;
- caja torácica y abdomen;
- pelvis;
- deltoides;
- brazos y antebrazos;
- glúteos;
- muslos;
- pantorrillas;
- pies simplificados;
- short como malla separada.

## Proporciones objetivo
La silueta debe aproximarse a la referencia aprobada desde, como mínimo, las vistas frontal, 3/4 frontal, lateral y posterior.

Criterios visuales:
1. hombros claramente más anchos que cintura;
2. tórax profundo y pectoral prominente;
3. brazos con volumen coherente con hombros y torso;
4. cintura atlética, pero no extremadamente estrecha;
5. muslos con masa comparable a la parte superior del cuerpo;
6. pantorrillas visibles y desarrolladas;
7. short corto que deje visible la mayor parte del cuádriceps;
8. ninguna forma debe verse como piezas pegadas u óvalos superpuestos.

## Convenciones técnicas
- Formato objetivo: GLB 2.0.
- Nombres base: `body__male_v4` y `clothes__shorts_male_v4`.
- Sistema de coordenadas y escala: compatible con el visor actual de AplicativoGym.
- La malla debe ser apta para subdivisión posterior en las zonas anatómicas definidas en Tasks 12.3–12.5.
- Evitar N-gons en la geometría final exportada.
- Mantener topología suficientemente limpia para segmentación posterior.

## Entregables
1. `human-male-base-v4.glb`.
2. Captura frontal del GLB real.
3. Captura 3/4 frontal del mismo GLB real.
4. Captura lateral o posterior para comprobar profundidad y espalda.
5. Comparativa visual con el mockup aprobado, claramente rotulada.

## Criterios de aceptación
La task no se considera aprobada solo porque el GLB cargue. El usuario debe confirmar visualmente que la silueta y la masa muscular se acercan al mockup aprobado.

Si la geometría carga pero visualmente no refleja la referencia, la task sigue abierta y se corrige antes de pasar al modelo femenino o a la segmentación muscular.

## Fuera de alcance
- nuevo diseño visual;
- modificar el mockup aprobado;
- cuerpo femenino;
- segmentación muscular interactiva;
- colores principal/secundario;
- animaciones;
- catálogo de ejercicios;
- publicación en producción.
