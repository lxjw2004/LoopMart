CREATE TABLE IF NOT EXISTS memberships(user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),community_id text NOT NULL DEFAULT 'purdue' CHECK(community_id='purdue'));
CREATE TABLE IF NOT EXISTS entities(id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('item','ride')),publisher_id text NOT NULL REFERENCES "user"(id), data jsonb NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deactivated','reported','deactivated_violation','deleted')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS favorites(user_id text REFERENCES "user"(id) ON DELETE CASCADE,item_id uuid REFERENCES entities(id),PRIMARY KEY(user_id,item_id));
CREATE TABLE IF NOT EXISTS conversations(id uuid PRIMARY KEY,user_a text NOT NULL REFERENCES "user"(id),user_b text NOT NULL REFERENCES "user"(id),CHECK(user_a<user_b),UNIQUE(user_a,user_b));
CREATE TABLE IF NOT EXISTS messages(seq bigserial UNIQUE,id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES conversations(id),sender_id text NOT NULL REFERENCES "user"(id),client_id text NOT NULL,text text NOT NULL,reference jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(conversation_id,sender_id,client_id));
CREATE TABLE IF NOT EXISTS reads(conversation_id uuid REFERENCES conversations(id),user_id text REFERENCES "user"(id),seq bigint NOT NULL REFERENCES messages(seq),PRIMARY KEY(conversation_id,user_id));
CREATE TABLE IF NOT EXISTS reports(id uuid PRIMARY KEY,reporter_id text NOT NULL REFERENCES "user"(id),target_type text NOT NULL,target_id text NOT NULL,reason text NOT NULL,details text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending',note text,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS contact(id uuid PRIMARY KEY,email text NOT NULL,subject text NOT NULL,message text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS audit(id uuid PRIMARY KEY,actor_id text REFERENCES "user"(id),action text NOT NULL,target_id text,reason text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),data jsonb NOT NULL);
INSERT INTO settings VALUES(true,'{"allowedEmailDomains":["purdue.edu"],"allowAllEmailDomains":false,"contactEnabled":true,"privacyPolicyZh":"","privacyPolicyEn":""}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS notification_jobs(id uuid PRIMARY KEY,payload jsonb NOT NULL,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz DEFAULT now(),completed_at timestamptz);
ALTER TABLE entities ADD CONSTRAINT entity_required_fields CHECK (
CASE WHEN kind='item' THEN
 jsonb_typeof(data->'title')='string' AND length(data->>'title') BETWEEN 1 AND 150
 AND data->>'category' IN ('clothing','books','furniture','electronics','daily','other')
 AND data->>'condition' IN ('new','like_new','good','fair')
 AND data->>'deliveryMethod' IN ('pickup','meetup','delivery')
 AND jsonb_typeof(data->'priceCents')='number' AND (data->>'priceCents')::numeric>=0 AND trunc((data->>'priceCents')::numeric)=(data->>'priceCents')::numeric
ELSE jsonb_typeof(data->'origin')='string' AND jsonb_typeof(data->'destination')='string'
 AND jsonb_typeof(data->'feeCents')='number' AND (data->>'feeCents')::numeric>=0 AND trunc((data->>'feeCents')::numeric)=(data->>'feeCents')::numeric
 AND (data->>'totalSeats')::numeric BETWEEN 1 AND 50 AND trunc((data->>'totalSeats')::numeric)=(data->>'totalSeats')::numeric
 AND (data->>'availableSeats')::numeric BETWEEN 0 AND (data->>'totalSeats')::numeric AND trunc((data->>'availableSeats')::numeric)=(data->>'availableSeats')::numeric
END);
ALTER TABLE reports ADD CONSTRAINT report_target_type CHECK(target_type IN ('item','ride','user','conversation'));
ALTER TABLE reports ADD CONSTRAINT report_status CHECK(status IN ('pending','reviewed','dismissed','violation_confirmed'));
CREATE INDEX entities_kind_status_id ON entities(kind,status,id);
CREATE INDEX messages_conversation_seq ON messages(conversation_id,seq);
CREATE INDEX jobs_pending ON notification_jobs(next_attempt_at) WHERE completed_at IS NULL;
