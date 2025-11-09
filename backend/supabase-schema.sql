-- T-Mobile Sentiment Analysis Database Schema

-- Tweets table to store social media data
CREATE TABLE IF NOT EXISTS tweets (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    username TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    topic TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_topic ON tweets(topic);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_tweets_coordinates ON tweets(latitude, longitude);

-- Enable Row Level Security
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;

-- Policy for access control
CREATE POLICY "Enable all access for authenticated users" ON tweets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Helper function to delete old tweets
CREATE OR REPLACE FUNCTION delete_old_tweets(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tweets
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function to delete tweets by topic
CREATE OR REPLACE FUNCTION delete_tweets_by_topic(topic_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tweets WHERE topic = topic_name;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
