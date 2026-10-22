/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_GADS_ID?: string; readonly VITE_GADS_LABEL?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
