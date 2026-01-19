-- Add GOOGLE to AuthProvider enum if not exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthProvider') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GOOGLE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuthProvider')) THEN
            ALTER TYPE "AuthProvider" ADD VALUE 'GOOGLE';
        END IF;
    END IF;
END $$;

-- Rename microsoftSubject to microsoft_subject if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ecommerce_usuario' AND column_name = 'microsoftSubject') THEN
        ALTER TABLE "ecommerce_usuario" RENAME COLUMN "microsoftSubject" TO "microsoft_subject";
    END IF;
END $$;

-- Add google_subject column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ecommerce_usuario' AND column_name = 'google_subject') THEN
        ALTER TABLE "ecommerce_usuario" ADD COLUMN "google_subject" TEXT;
    END IF;
END $$;

-- Drop old unique constraint if exists
DROP INDEX IF EXISTS "ecommerce_usuario_microsoftSubject_key";

-- Create new unique constraints if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ecommerce_usuario_microsoft_subject_key') THEN
        CREATE UNIQUE INDEX "ecommerce_usuario_microsoft_subject_key" ON "ecommerce_usuario"("microsoft_subject");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ecommerce_usuario_google_subject_key') THEN
        CREATE UNIQUE INDEX "ecommerce_usuario_google_subject_key" ON "ecommerce_usuario"("google_subject");
    END IF;
END $$;
