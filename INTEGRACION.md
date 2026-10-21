# Integración de red vial nacional — comprobaciones

Antes de modificar el código de aplicación, ejecutar en SQL Editor:

```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'geotracia_national_roads'
ORDER BY ordinal_position;
```

Luego verificar cómo se representan la geometría y el identificador de origen.
La tabla `roads` actualmente se usa para caminos vinculados a un proyecto; la tabla
nacional debe consultarse como catálogo y no duplicarse completa en `roads`.

Flujo objetivo:
1. Buscar en `geotracia_national_roads` por nombre/código.
2. Mostrar resultados con identificador, nombre y geometría.
3. Al seleccionar, crear un registro operativo de `roads` asociado al proyecto y
   guardar la referencia al identificador nacional en un campo de procedencia o
   atributos, sin duplicar la geometría completa si no es necesario.
4. Dibujar la geometría vial seleccionada en el mapa y calcular longitud desde la
   geometría real, nunca desde una línea recta.
5. Probar con un camino y un proyecto de demostración.
