import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "AGIOPAY: faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. " +
      "Crie um arquivo .env na raiz do projeto (veja .env.example) com as chaves do seu projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
