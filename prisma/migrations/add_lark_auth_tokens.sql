-- Create table for storing Lark OAuth tokens
CREATE TABLE IF NOT EXISTS lark_auth_tokens (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL UNIQUE,
    user_name VARCHAR(255),
    lark_user_id VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    calendar_id VARCHAR(255),
    scopes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for quick lookups
CREATE INDEX idx_lark_auth_email ON lark_auth_tokens(user_email);
CREATE INDEX idx_lark_auth_expires ON lark_auth_tokens(expires_at);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lark_auth_tokens_updated_at 
    BEFORE UPDATE ON lark_auth_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();