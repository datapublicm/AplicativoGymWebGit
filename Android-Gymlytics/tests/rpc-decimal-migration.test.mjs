import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20261011033900_gymlytics_guardar_series_decimales_20261010.sql',import.meta.url),'utf8');

test('Migración del RPC acepta repeticiones y asistencia NUMERIC sin redondeo entero',()=>{
 assert.match(sql,/\(item->>'repeticiones'\)::numeric/);
 assert.match(sql,/\(item->>'asistencias'\)::numeric/);
 assert.doesNotMatch(sql,/\(item->>'(?:repeticiones|asistencias)'\)::integer/);
 assert.equal((sql.match(/::integer/g)||[]).length,1,'Solo el índice numero_serie es entero');
});
test('La migración conserva control Auth y límite atómico de 24 series',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION sch_android_gymlytics\.guardar_entrenamiento/);
 assert.match(sql,/auth\.uid\(\) IS NULL OR NOT sch_android_gymlytics\.usuario_habilitado\(\)/);
 assert.match(sql,/jsonb_array_length\(p_series\) NOT BETWEEN 1 AND 24/);
 assert.match(sql,/LANGUAGE plpgsql/);
 assert.match(sql,/SET search_path TO ''/);
 assert.doesNotMatch(sql,/SECURITY DEFINER/i);
 assert.match(sql,/RETURNING id INTO rid/);
 assert.match(sql,/INSERT INTO sch_android_gymlytics\.tbl_series/);
});
