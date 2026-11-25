export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assessment_results: {
        Row: {
          assessment_id: string
          graded_at: string | null
          graded_by: string | null
          id: string
          remarks: string | null
          score: number
          student_id: string
        }
        Insert: {
          assessment_id: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          remarks?: string | null
          score: number
          student_id: string
        }
        Update: {
          assessment_id?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          remarks?: string | null
          score?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_date: string
          course_id: string
          created_at: string | null
          created_by: string | null
          form_url: string | null
          id: string
          max_score: number
          sheet_url: string | null
          title: string
        }
        Insert: {
          assessment_date: string
          course_id: string
          created_at?: string | null
          created_by?: string | null
          form_url?: string | null
          id?: string
          max_score: number
          sheet_url?: string | null
          title: string
        }
        Update: {
          assessment_date?: string
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          form_url?: string | null
          id?: string
          max_score?: number
          sheet_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          marked_by: string | null
          session_date: string
          status: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          marked_by?: string | null
          session_date: string
          status: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          marked_by?: string | null
          session_date?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: number
          new_values: Json | null
          old_values: Json | null
          record_id: string
          request_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          request_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          request_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_settings: {
        Row: {
          display_name: string
          id: string
          invoice_prefix: string
          legal_name: string
          short_name: string
          support_email: string
          tagline: string
          updated_at: string
          verify_base_url: string
          website_url: string
        }
        Insert: {
          display_name?: string
          id?: string
          invoice_prefix?: string
          legal_name?: string
          short_name?: string
          support_email?: string
          tagline?: string
          updated_at?: string
          verify_base_url?: string
          website_url?: string
        }
        Update: {
          display_name?: string
          id?: string
          invoice_prefix?: string
          legal_name?: string
          short_name?: string
          support_email?: string
          tagline?: string
          updated_at?: string
          verify_base_url?: string
          website_url?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_id: string
          course_name: string
          custom_note: string | null
          director_name: string | null
          end_date: string | null
          id: string
          issue_date: string
          issued_at: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          skills: string[]
          start_date: string | null
          student_id: string
          student_name: string
          student_register_id: number
          trainer_name: string | null
        }
        Insert: {
          certificate_id: string
          course_name: string
          custom_note?: string | null
          director_name?: string | null
          end_date?: string | null
          id?: string
          issue_date?: string
          issued_at?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          skills?: string[]
          start_date?: string | null
          student_id: string
          student_name: string
          student_register_id: number
          trainer_name?: string | null
        }
        Update: {
          certificate_id?: string
          course_name?: string
          custom_note?: string | null
          director_name?: string | null
          end_date?: string | null
          id?: string
          issue_date?: string
          issued_at?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          skills?: string[]
          start_date?: string | null
          student_id?: string
          student_name?: string
          student_register_id?: number
          trainer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_register_id_fkey"
            columns: ["student_register_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "certificates_student_register_id_fkey"
            columns: ["student_register_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "certificates_student_register_id_fkey"
            columns: ["student_register_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["register_id"]
          },
        ]
      }
      course_categories: {
        Row: {
          created_at: string
          duration: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_materials: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          storage_path: string
          title: string
          type: string
          uploaded_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          storage_path: string
          title: string
          type: string
          uploaded_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          storage_path?: string
          title?: string
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_trainers: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          course_id: string
          trainer_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          course_id: string
          trainer_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          course_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_trainers_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_trainers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_trainers_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          duration: string | null
          fee: number
          gst_inclusive: boolean
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          fee?: number
          gst_inclusive?: boolean
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          fee?: number
          gst_inclusive?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_settings: {
        Row: {
          enabled: boolean
          gstin: string | null
          id: string
          rate: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          gstin?: string | null
          id?: string
          rate?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          gstin?: string | null
          id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          actor_id: string
          created_at: string
          expires_at: string
          idempotency_key: string
          request_hash: string
          response: Json | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          expires_at?: string
          idempotency_key: string
          request_hash: string
          response?: Json | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          request_hash?: string
          response?: Json | null
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_used: boolean
          recipient_email: string | null
          role: string
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          is_used?: boolean
          recipient_email?: string | null
          role: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_used?: boolean
          recipient_email?: string | null
          role?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          message: string
          recipient_role: string
          title: string
          type: string
          urgent: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          message: string
          recipient_role?: string
          title: string
          type?: string
          urgent?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          message?: string
          recipient_role?: string
          title?: string
          type?: string
          urgent?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst: number
          created_at: string
          custom_note: string | null
          grand_total: number | null
          gst_inclusive: boolean
          gst_rate: number
          id: string
          instance_number: number | null
          invoice: string
          method: string
          payment_date: string
          payment_type: string | null
          sgst: number
          student_id: string
          student_register_id: number
          taxable_value: number | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst?: number
          created_at?: string
          custom_note?: string | null
          grand_total?: number | null
          gst_inclusive?: boolean
          gst_rate?: number
          id: string
          instance_number?: number | null
          invoice: string
          method: string
          payment_date?: string
          payment_type?: string | null
          sgst?: number
          student_id: string
          student_register_id: number
          taxable_value?: number | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst?: number
          created_at?: string
          custom_note?: string | null
          grand_total?: number | null
          gst_inclusive?: boolean
          gst_rate?: number
          id?: string
          instance_number?: number | null
          invoice?: string
          method?: string
          payment_date?: string
          payment_type?: string | null
          sgst?: number
          student_id?: string
          student_register_id?: number
          taxable_value?: number | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_register_id_fkey"
            columns: ["student_register_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "payments_student_register_id_fkey"
            columns: ["student_register_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "payments_student_register_id_fkey"
            columns: ["student_register_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["register_id"]
          },
        ]
      }
      profiles: {
        Row: {
          contact_details: Json
          created_at: string | null
          disabled_at: string | null
          disabled_by: string | null
          full_name: string
          id: string
          metadata: Json
          role: string
        }
        Insert: {
          contact_details?: Json
          created_at?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          full_name: string
          id: string
          metadata?: Json
          role?: string
        }
        Update: {
          contact_details?: Json
          created_at?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          full_name?: string
          id?: string
          metadata?: Json
          role?: string
        }
        Relationships: []
      }
      skill_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          alt_phone: string | null
          area: string | null
          batch: string
          city: string | null
          comments: string | null
          country: string | null
          course: string
          created_at: string
          dob: string | null
          email: string | null
          gender: string | null
          id: string
          knowledge_tags: string[]
          lead_source: string | null
          marital_status: string | null
          name: string
          paid: number
          phone: string
          register_id: number
          state: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          alt_phone?: string | null
          area?: string | null
          batch: string
          city?: string | null
          comments?: string | null
          country?: string | null
          course: string
          created_at?: string
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          knowledge_tags?: string[]
          lead_source?: string | null
          marital_status?: string | null
          name: string
          paid?: number
          phone: string
          register_id?: number
          state?: string | null
          status?: string
          total: number
          updated_at?: string
        }
        Update: {
          alt_phone?: string | null
          area?: string | null
          batch?: string
          city?: string | null
          comments?: string | null
          country?: string | null
          course?: string
          created_at?: string
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          knowledge_tags?: string[]
          lead_source?: string | null
          marital_status?: string | null
          name?: string
          paid?: number
          phone?: string
          register_id?: number
          state?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      verifiable_documents: {
        Row: {
          doc_type: string
          id: string
          issued_at: string | null
          reference_id: string
          revoked_at: string | null
          status: string
          verification_code: string
        }
        Insert: {
          doc_type: string
          id?: string
          issued_at?: string | null
          reference_id: string
          revoked_at?: string | null
          status?: string
          verification_code: string
        }
        Update: {
          doc_type?: string
          id?: string
          issued_at?: string | null
          reference_id?: string
          revoked_at?: string | null
          status?: string
          verification_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      attendance_course_summary: {
        Row: {
          attendance_percent: number | null
          course_id: string | null
          course_name: string | null
          present_sessions: number | null
          sessions: number | null
          students: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_summary: {
        Row: {
          attendance_percent: number | null
          course_id: string | null
          course_name: string | null
          present_sessions: number | null
          register_id: number | null
          sessions: number | null
          student_id: string | null
          student_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_ledger_mismatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_ledger_mismatches: {
        Row: {
          id: string | null
          ledger_paid: number | null
          paid: number | null
          register_id: number | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cancel_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      admin_change_profile_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_revoke_certificate: {
        Args: { p_certificate_uuid: string; p_reason: string }
        Returns: undefined
      }
      admin_set_user_disabled: {
        Args: { p_disabled: boolean; p_user_id: string }
        Returns: undefined
      }
      can_access_assessment: {
        Args: { p_assessment_id: string }
        Returns: boolean
      }
      can_access_course: { Args: { p_course_id: string }; Returns: boolean }
      can_access_course_name: {
        Args: { p_course_name: string }
        Returns: boolean
      }
      can_access_material_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      compute_payment_tax: {
        Args: { p_amount: number; p_inclusive: boolean; p_rate: number }
        Returns: {
          cgst: number
          sgst: number
        }[]
      }
      create_student_with_payment: {
        Args: {
          p_initial_payment_amount: number
          p_initial_payment_date: string
          p_student: Json
          p_verification_code: string
        }
        Returns: Json
      }
      create_student_with_payment_idempotent: {
        Args: {
          p_idempotency_key: string
          p_initial_payment_amount: number
          p_initial_payment_date: string
          p_request_hash: string
          p_student: Json
          p_verification_code: string
        }
        Returns: Json
      }
      get_app_readiness: {
        Args: { p_expected_migration: string }
        Returns: {
          current_migration: string
          migration_matches: boolean
        }[]
      }
      get_dashboard_summary: { Args: never; Returns: Json }
      get_dashboard_summary_for_period: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      idempotency_begin: {
        Args: { p_actor: string; p_hash: string; p_key: string }
        Returns: Json
      }
      idempotency_finish: {
        Args: { p_actor: string; p_key: string; p_response: Json }
        Returns: undefined
      }
      india_today: { Args: never; Returns: string }
      is_current_user_admin: { Args: never; Returns: boolean }
      issue_certificate: {
        Args: {
          p_custom_note: string
          p_director_name: string
          p_end_date: string
          p_issue_date: string
          p_skills: string[]
          p_start_date: string
          p_student_register_id: number
          p_trainer_name: string
          p_verification_code: string
        }
        Returns: Json
      }
      ordinal_label: { Args: { p_n: number }; Returns: string }
      profile_display_names: {
        Args: { p_ids: string[] }
        Returns: {
          full_name: string
          id: string
          role: string
        }[]
      }
      public_verify_document: {
        Args: { p_code: string }
        Returns: {
          course_name: string
          document_type: string
          invoice_number: string
          issue_date: string
          status: string
          student_name: string
        }[]
      }
      record_payment: {
        Args: {
          p_amount: number
          p_custom_note: string
          p_method: string
          p_payment_date: string
          p_payment_type: string
          p_student_register_id: number
          p_transaction_id: string
          p_verification_code: string
        }
        Returns: Json
      }
      record_payment_idempotent: {
        Args: {
          p_amount: number
          p_custom_note: string
          p_idempotency_key: string
          p_method: string
          p_payment_date: string
          p_payment_type: string
          p_request_hash: string
          p_student_register_id: number
          p_transaction_id: string
          p_verification_code: string
        }
        Returns: Json
      }
      redeem_invite_code: {
        Args: { p_code: string; p_email: string; p_user_id: string }
        Returns: string
      }
      sync_student_paid_from_ledger: {
        Args: { p_student_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

