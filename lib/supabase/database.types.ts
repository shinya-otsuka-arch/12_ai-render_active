export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          role: "admin" | "user";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: "admin" | "user";
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: "admin" | "user";
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
          local_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
          local_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
          local_id?: string | null;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: "owner" | "member";
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role: "owner" | "member";
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: "owner" | "member";
          created_at?: string;
        };
        Relationships: [];
      };
      project_assets: {
        Row: {
          id: string;
          project_id: string;
          mode: "render" | "redesign" | "staging" | "edit" | "enhance" | "gemini";
          after_path: string;
          before_path: string | null;
          params: Json | null;
          created_by: string;
          created_at: string;
          local_id: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          mode: "render" | "redesign" | "staging" | "edit" | "enhance" | "gemini";
          after_path: string;
          before_path?: string | null;
          params?: Json | null;
          created_by: string;
          created_at?: string;
          local_id?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          mode?: "render" | "redesign" | "staging" | "edit" | "enhance" | "gemini";
          after_path?: string;
          before_path?: string | null;
          params?: Json | null;
          created_by?: string;
          created_at?: string;
          local_id?: string | null;
        };
        Relationships: [];
      };
      style_library: {
        Row: {
          id: string;
          image_path: string;
          style_brief: string | null;
          label: string | null;
          created_by: string;
          created_at: string;
          local_id: string | null;
        };
        Insert: {
          id?: string;
          image_path: string;
          style_brief?: string | null;
          label?: string | null;
          created_by: string;
          created_at?: string;
          local_id?: string | null;
        };
        Update: {
          id?: string;
          image_path?: string;
          style_brief?: string | null;
          label?: string | null;
          created_by?: string;
          created_at?: string;
          local_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: { Args: { pid: string }; Returns: boolean };
      is_project_owner: { Args: { pid: string }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
