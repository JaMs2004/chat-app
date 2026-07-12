// ============================================================
// CONFIGURACIÓN DE SUPABASE
// Reemplaza estos dos valores con los de tu proyecto:
// Supabase Dashboard > Project Settings > API
// ============================================================
export const SUPABASE_URL = "https://umvvbzsxgulaeqwirmxi.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdnZienN4Z3VsYWVxd2lybXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njc3OTgsImV4cCI6MjA5OTQ0Mzc5OH0.dl1iCC_6dx0Uuk88QSEoiwZ6Zdi7dOgk7ol8yZSDHW8";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);