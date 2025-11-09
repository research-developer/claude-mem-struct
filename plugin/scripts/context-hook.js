#!/usr/bin/env node
import X from"path";import{stdin as $}from"process";import se from"better-sqlite3";import{join as S,dirname as Q,basename as _e}from"path";import{homedir as j}from"os";import{existsSync as le,mkdirSync as z}from"fs";import{fileURLToPath as Z}from"url";function ee(){return typeof __dirname<"u"?__dirname:Q(Z(import.meta.url))}var he=ee(),f=process.env.CLAUDE_MEM_DATA_DIR||S(j(),".claude-mem"),U=process.env.CLAUDE_CONFIG_DIR||S(j(),".claude"),be=S(f,"archives"),ge=S(f,"logs"),Se=S(f,"trash"),Re=S(f,"backups"),Ne=S(f,"settings.json"),G=S(f,"claude-mem.db"),Oe=S(f,"vector-db"),Ie=S(U,"settings.json"),fe=S(U,"commands"),Le=S(U,"CLAUDE.md");function P(p){z(p,{recursive:!0})}var k=(i=>(i[i.DEBUG=0]="DEBUG",i[i.INFO=1]="INFO",i[i.WARN=2]="WARN",i[i.ERROR=3]="ERROR",i[i.SILENT=4]="SILENT",i))(k||{}),M=class{level;useColor;constructor(){let e=process.env.CLAUDE_MEM_LOG_LEVEL?.toUpperCase()||"INFO";this.level=k[e]??1,this.useColor=process.stdout.isTTY??!1}correlationId(e,s){return`obs-${e}-${s}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.level===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let s=Object.keys(e);return s.length===0?"{}":s.length<=3?JSON.stringify(e):`{${s.length} keys: ${s.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,s){if(!s)return e;try{let t=typeof s=="string"?JSON.parse(s):s;if(e==="Bash"&&t.command){let r=t.command.length>50?t.command.substring(0,50)+"...":t.command;return`${e}(${r})`}if(e==="Read"&&t.file_path){let r=t.file_path.split("/").pop()||t.file_path;return`${e}(${r})`}if(e==="Edit"&&t.file_path){let r=t.file_path.split("/").pop()||t.file_path;return`${e}(${r})`}if(e==="Write"&&t.file_path){let r=t.file_path.split("/").pop()||t.file_path;return`${e}(${r})`}return e}catch{return e}}log(e,s,t,r,i){if(e<this.level)return;let a=new Date().toISOString().replace("T"," ").substring(0,23),d=k[e].padEnd(5),_=s.padEnd(6),l="";r?.correlationId?l=`[${r.correlationId}] `:r?.sessionId&&(l=`[session-${r.sessionId}] `);let b="";i!=null&&(this.level===0&&typeof i=="object"?b=`
`+JSON.stringify(i,null,2):b=" "+this.formatData(i));let n="";if(r){let{sessionId:R,sdkSessionId:O,correlationId:E,...c}=r;Object.keys(c).length>0&&(n=` {${Object.entries(c).map(([m,T])=>`${m}=${T}`).join(", ")}}`)}let A=`[${a}] [${d}] [${_}] ${l}${t}${n}${b}`;e===3?console.error(A):console.log(A)}debug(e,s,t,r){this.log(0,e,s,t,r)}info(e,s,t,r){this.log(1,e,s,t,r)}warn(e,s,t,r){this.log(2,e,s,t,r)}error(e,s,t,r){this.log(3,e,s,t,r)}dataIn(e,s,t,r){this.info(e,`\u2192 ${s}`,t,r)}dataOut(e,s,t,r){this.info(e,`\u2190 ${s}`,t,r)}success(e,s,t,r){this.info(e,`\u2713 ${s}`,t,r)}failure(e,s,t,r){this.error(e,`\u2717 ${s}`,t,r)}timing(e,s,t,r){this.info(e,`\u23F1 ${s}`,r,{duration:`${t}ms`})}},H=new M;var D=class{db;constructor(){P(f),this.db=new se(G),this.db.pragma("journal_mode = WAL"),this.db.pragma("synchronous = NORMAL"),this.db.pragma("foreign_keys = ON"),this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.addDimensionalFields(),this.createGitCommitsTable()}initializeSchema(){try{this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_versions (
          id INTEGER PRIMARY KEY,
          version INTEGER UNIQUE NOT NULL,
          applied_at TEXT NOT NULL
        )
      `);let e=this.db.prepare("SELECT version FROM schema_versions ORDER BY version").all();(e.length>0?Math.max(...e.map(t=>t.version)):0)===0&&(console.error("[SessionStore] Initializing fresh database with migration004..."),this.db.exec(`
          CREATE TABLE IF NOT EXISTS sdk_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claude_session_id TEXT UNIQUE NOT NULL,
            sdk_session_id TEXT UNIQUE,
            project TEXT NOT NULL,
            user_prompt TEXT,
            started_at TEXT NOT NULL,
            started_at_epoch INTEGER NOT NULL,
            completed_at TEXT,
            completed_at_epoch INTEGER,
            status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
          );

          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_claude_id ON sdk_sessions(claude_session_id);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_sdk_id ON sdk_sessions(sdk_session_id);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC);

          CREATE TABLE IF NOT EXISTS observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT NOT NULL,
            project TEXT NOT NULL,
            text TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery')),
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_observations_sdk_session ON observations(sdk_session_id);
          CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
          CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
          CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);

          CREATE TABLE IF NOT EXISTS session_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT UNIQUE NOT NULL,
            project TEXT NOT NULL,
            request TEXT,
            investigated TEXT,
            learned TEXT,
            completed TEXT,
            next_steps TEXT,
            files_read TEXT,
            files_edited TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_session_summaries_sdk_session ON session_summaries(sdk_session_id);
          CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
          CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
        `),this.db.prepare("INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString()),console.error("[SessionStore] Migration004 applied successfully"))}catch(e){throw console.error("[SessionStore] Schema initialization error:",e.message),e}}ensureWorkerPortColumn(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(5))return;this.db.pragma("table_info(sdk_sessions)").some(r=>r.name==="worker_port")||(this.db.exec("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),console.error("[SessionStore] Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}catch(e){console.error("[SessionStore] Migration error:",e.message)}}ensurePromptTrackingColumns(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(6))return;this.db.pragma("table_info(sdk_sessions)").some(_=>_.name==="prompt_counter")||(this.db.exec("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),console.error("[SessionStore] Added prompt_counter column to sdk_sessions table")),this.db.pragma("table_info(observations)").some(_=>_.name==="prompt_number")||(this.db.exec("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),console.error("[SessionStore] Added prompt_number column to observations table")),this.db.pragma("table_info(session_summaries)").some(_=>_.name==="prompt_number")||(this.db.exec("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),console.error("[SessionStore] Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}catch(e){console.error("[SessionStore] Prompt tracking migration error:",e.message)}}removeSessionSummariesUniqueConstraint(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(7))return;if(!this.db.pragma("index_list(session_summaries)").some(r=>r.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}console.error("[SessionStore] Removing UNIQUE constraint from session_summaries.sdk_session_id..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
          CREATE TABLE session_summaries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT NOT NULL,
            project TEXT NOT NULL,
            request TEXT,
            investigated TEXT,
            learned TEXT,
            completed TEXT,
            next_steps TEXT,
            files_read TEXT,
            files_edited TEXT,
            notes TEXT,
            prompt_number INTEGER,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          )
        `),this.db.exec(`
          INSERT INTO session_summaries_new
          SELECT id, sdk_session_id, project, request, investigated, learned,
                 completed, next_steps, files_read, files_edited, notes,
                 prompt_number, created_at, created_at_epoch
          FROM session_summaries
        `),this.db.exec("DROP TABLE session_summaries"),this.db.exec("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.exec(`
          CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(sdk_session_id);
          CREATE INDEX idx_session_summaries_project ON session_summaries(project);
          CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),console.error("[SessionStore] Successfully removed UNIQUE constraint from session_summaries.sdk_session_id")}catch(r){throw this.db.exec("ROLLBACK"),r}}catch(e){console.error("[SessionStore] Migration error (remove UNIQUE constraint):",e.message)}}addObservationHierarchicalFields(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.pragma("table_info(observations)").some(r=>r.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}console.error("[SessionStore] Adding hierarchical fields to observations table..."),this.db.exec(`
        ALTER TABLE observations ADD COLUMN title TEXT;
        ALTER TABLE observations ADD COLUMN subtitle TEXT;
        ALTER TABLE observations ADD COLUMN facts TEXT;
        ALTER TABLE observations ADD COLUMN narrative TEXT;
        ALTER TABLE observations ADD COLUMN concepts TEXT;
        ALTER TABLE observations ADD COLUMN files_read TEXT;
        ALTER TABLE observations ADD COLUMN files_modified TEXT;
      `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),console.error("[SessionStore] Successfully added hierarchical fields to observations table")}catch(e){console.error("[SessionStore] Migration error (add hierarchical fields):",e.message)}}makeObservationsTextNullable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let t=this.db.pragma("table_info(observations)").find(r=>r.name==="text");if(!t||t.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}console.error("[SessionStore] Making observations.text nullable..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
          CREATE TABLE observations_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT NOT NULL,
            project TEXT NOT NULL,
            text TEXT,
            type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery', 'change')),
            title TEXT,
            subtitle TEXT,
            facts TEXT,
            narrative TEXT,
            concepts TEXT,
            files_read TEXT,
            files_modified TEXT,
            prompt_number INTEGER,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          )
        `),this.db.exec(`
          INSERT INTO observations_new
          SELECT id, sdk_session_id, project, text, type, title, subtitle, facts,
                 narrative, concepts, files_read, files_modified, prompt_number,
                 created_at, created_at_epoch
          FROM observations
        `),this.db.exec("DROP TABLE observations"),this.db.exec("ALTER TABLE observations_new RENAME TO observations"),this.db.exec(`
          CREATE INDEX idx_observations_sdk_session ON observations(sdk_session_id);
          CREATE INDEX idx_observations_project ON observations(project);
          CREATE INDEX idx_observations_type ON observations(type);
          CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),console.error("[SessionStore] Successfully made observations.text nullable")}catch(r){throw this.db.exec("ROLLBACK"),r}}catch(e){console.error("[SessionStore] Migration error (make text nullable):",e.message)}}createUserPromptsTable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.pragma("table_info(user_prompts)").length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}console.error("[SessionStore] Creating user_prompts table with FTS5 support..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
          CREATE TABLE user_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claude_session_id TEXT NOT NULL,
            prompt_number INTEGER NOT NULL,
            prompt_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(claude_session_id) REFERENCES sdk_sessions(claude_session_id) ON DELETE CASCADE
          );

          CREATE INDEX idx_user_prompts_claude_session ON user_prompts(claude_session_id);
          CREATE INDEX idx_user_prompts_created ON user_prompts(created_at_epoch DESC);
          CREATE INDEX idx_user_prompts_prompt_number ON user_prompts(prompt_number);
        `),this.db.exec(`
          CREATE VIRTUAL TABLE user_prompts_fts USING fts5(
            prompt_text,
            content='user_prompts',
            content_rowid='id'
          );
        `),this.db.exec(`
          CREATE TRIGGER user_prompts_ai AFTER INSERT ON user_prompts BEGIN
            INSERT INTO user_prompts_fts(rowid, prompt_text)
            VALUES (new.id, new.prompt_text);
          END;

          CREATE TRIGGER user_prompts_ad AFTER DELETE ON user_prompts BEGIN
            INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
            VALUES('delete', old.id, old.prompt_text);
          END;

          CREATE TRIGGER user_prompts_au AFTER UPDATE ON user_prompts BEGIN
            INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
            VALUES('delete', old.id, old.prompt_text);
            INSERT INTO user_prompts_fts(rowid, prompt_text)
            VALUES (new.id, new.prompt_text);
          END;
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),console.error("[SessionStore] Successfully created user_prompts table with FTS5 support")}catch(t){throw this.db.exec("ROLLBACK"),t}}catch(e){console.error("[SessionStore] Migration error (create user_prompts table):",e.message)}}addDimensionalFields(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;if(this.db.pragma("table_info(observations)").some(r=>r.name==="dim_why")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString());return}console.error("[SessionStore] Adding SixSpec dimensional fields..."),this.db.exec(`
        ALTER TABLE observations ADD COLUMN dim_who TEXT;
        ALTER TABLE observations ADD COLUMN dim_what TEXT;
        ALTER TABLE observations ADD COLUMN dim_when TEXT;
        ALTER TABLE observations ADD COLUMN dim_where TEXT;
        ALTER TABLE observations ADD COLUMN dim_why TEXT;
        ALTER TABLE observations ADD COLUMN dim_how TEXT;

        ALTER TABLE observations ADD COLUMN confidence_who REAL DEFAULT 1.0;
        ALTER TABLE observations ADD COLUMN confidence_what REAL DEFAULT 1.0;
        ALTER TABLE observations ADD COLUMN confidence_when REAL DEFAULT 1.0;
        ALTER TABLE observations ADD COLUMN confidence_where REAL DEFAULT 1.0;
        ALTER TABLE observations ADD COLUMN confidence_why REAL DEFAULT 1.0;
        ALTER TABLE observations ADD COLUMN confidence_how REAL DEFAULT 1.0;

        ALTER TABLE observations ADD COLUMN validation_score REAL;
        ALTER TABLE observations ADD COLUMN parent_observation_id INTEGER;
        ALTER TABLE observations ADD COLUMN dilts_level INTEGER;

        CREATE INDEX IF NOT EXISTS idx_observations_parent ON observations(parent_observation_id);
        CREATE INDEX IF NOT EXISTS idx_observations_dilts_level ON observations(dilts_level);
      `),this.db.exec(`
        ALTER TABLE session_summaries ADD COLUMN dim_who TEXT;
        ALTER TABLE session_summaries ADD COLUMN dim_what TEXT;
        ALTER TABLE session_summaries ADD COLUMN dim_when TEXT;
        ALTER TABLE session_summaries ADD COLUMN dim_where TEXT;
        ALTER TABLE session_summaries ADD COLUMN dim_why TEXT;
        ALTER TABLE session_summaries ADD COLUMN dim_how TEXT;
      `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString()),console.error("[SessionStore] Successfully added SixSpec dimensional fields")}catch(e){console.error("[SessionStore] Migration error (add dimensional fields):",e.message)}}createGitCommitsTable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(12))return;if(this.db.pragma("table_info(git_commits)").length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(12,new Date().toISOString());return}console.error("[SessionStore] Creating git_commits table with FTS5 support..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
          CREATE TABLE git_commits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commit_hash TEXT UNIQUE NOT NULL,
            commit_type TEXT NOT NULL CHECK(commit_type IN ('feat', 'fix', 'refactor', 'docs', 'test', 'chore')),
            subject TEXT NOT NULL,
            project TEXT NOT NULL,
            dim_who TEXT,
            dim_what TEXT,
            dim_when TEXT,
            dim_where TEXT,
            dim_why TEXT NOT NULL,
            dim_how TEXT NOT NULL,
            committed_at TEXT NOT NULL,
            committed_at_epoch INTEGER NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_git_commits_project ON git_commits(project);
          CREATE INDEX IF NOT EXISTS idx_git_commits_type ON git_commits(commit_type);
          CREATE INDEX IF NOT EXISTS idx_git_commits_why ON git_commits(dim_why);
          CREATE INDEX IF NOT EXISTS idx_git_commits_how ON git_commits(dim_how);
          CREATE INDEX IF NOT EXISTS idx_git_commits_where ON git_commits(dim_where);
          CREATE INDEX IF NOT EXISTS idx_git_commits_committed ON git_commits(committed_at_epoch DESC);
        `),this.db.exec(`
          CREATE VIRTUAL TABLE git_commits_fts USING fts5(
            subject,
            dim_why,
            dim_how,
            dim_what,
            dim_where,
            dim_who,
            content='git_commits',
            content_rowid='id'
          );
        `),this.db.exec(`
          CREATE TRIGGER git_commits_ai AFTER INSERT ON git_commits BEGIN
            INSERT INTO git_commits_fts(rowid, subject, dim_why, dim_how, dim_what, dim_where, dim_who)
            VALUES (new.id, new.subject, new.dim_why, new.dim_how, new.dim_what, new.dim_where, new.dim_who);
          END;

          CREATE TRIGGER git_commits_ad AFTER DELETE ON git_commits BEGIN
            INSERT INTO git_commits_fts(git_commits_fts, rowid, subject, dim_why, dim_how, dim_what, dim_where, dim_who)
            VALUES('delete', old.id, old.subject, old.dim_why, old.dim_how, old.dim_what, old.dim_where, old.dim_who);
          END;

          CREATE TRIGGER git_commits_au AFTER UPDATE ON git_commits BEGIN
            INSERT INTO git_commits_fts(git_commits_fts, rowid, subject, dim_why, dim_how, dim_what, dim_where, dim_who)
            VALUES('delete', old.id, old.subject, old.dim_why, old.dim_how, old.dim_what, old.dim_where, old.dim_who);
            INSERT INTO git_commits_fts(rowid, subject, dim_why, dim_how, dim_what, dim_where, dim_who)
            VALUES (new.id, new.subject, new.dim_why, new.dim_how, new.dim_what, new.dim_where, new.dim_who);
          END;
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(12,new Date().toISOString()),console.error("[SessionStore] Successfully created git_commits table with FTS5 support")}catch(t){throw this.db.exec("ROLLBACK"),t}}catch(e){console.error("[SessionStore] Migration error (create git_commits table):",e.message)}}getRecentSummaries(e,s=10){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getRecentSummariesWithSessionInfo(e,s=3){return this.db.prepare(`
      SELECT
        sdk_session_id, request, learned, completed, next_steps,
        prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getRecentObservations(e,s=20){return this.db.prepare(`
      SELECT type, text, prompt_number, created_at
      FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getAllRecentObservations(e=100){return this.db.prepare(`
      SELECT id, type, title, subtitle, text, project, prompt_number, created_at, created_at_epoch
      FROM observations
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentSummaries(e=50){return this.db.prepare(`
      SELECT id, request, investigated, learned, completed, next_steps,
             files_read, files_edited, notes, project, prompt_number,
             created_at, created_at_epoch
      FROM session_summaries
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentUserPrompts(e=100){return this.db.prepare(`
      SELECT
        up.id,
        up.claude_session_id,
        s.project,
        up.prompt_number,
        up.prompt_text,
        up.created_at,
        up.created_at_epoch
      FROM user_prompts up
      LEFT JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      ORDER BY up.created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllProjects(){return this.db.prepare(`
      SELECT DISTINCT project
      FROM sdk_sessions
      WHERE project IS NOT NULL AND project != ''
      ORDER BY project ASC
    `).all().map(t=>t.project)}getRecentSessionsWithStatus(e,s=3){return this.db.prepare(`
      SELECT * FROM (
        SELECT
          s.sdk_session_id,
          s.status,
          s.started_at,
          s.started_at_epoch,
          s.user_prompt,
          CASE WHEN sum.sdk_session_id IS NOT NULL THEN 1 ELSE 0 END as has_summary
        FROM sdk_sessions s
        LEFT JOIN session_summaries sum ON s.sdk_session_id = sum.sdk_session_id
        WHERE s.project = ? AND s.sdk_session_id IS NOT NULL
        GROUP BY s.sdk_session_id
        ORDER BY s.started_at_epoch DESC
        LIMIT ?
      )
      ORDER BY started_at_epoch ASC
    `).all(e,s)}getObservationsForSession(e){return this.db.prepare(`
      SELECT title, subtitle, type, prompt_number
      FROM observations
      WHERE sdk_session_id = ?
      ORDER BY created_at_epoch ASC
    `).all(e)}getObservationById(e){return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id = ?
    `).get(e)||null}getObservationsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r}=s,i=t==="date_asc"?"ASC":"DESC",a=r?`LIMIT ${r}`:"",d=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id IN (${d})
      ORDER BY created_at_epoch ${i}
      ${a}
    `).all(...e)}getSummaryForSession(e){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE sdk_session_id = ?
      ORDER BY created_at_epoch DESC
      LIMIT 1
    `).get(e)||null}getFilesForSession(e){let t=this.db.prepare(`
      SELECT files_read, files_modified
      FROM observations
      WHERE sdk_session_id = ?
    `).all(e),r=new Set,i=new Set;for(let a of t){if(a.files_read)try{let d=JSON.parse(a.files_read);Array.isArray(d)&&d.forEach(_=>r.add(_))}catch{}if(a.files_modified)try{let d=JSON.parse(a.files_modified);Array.isArray(d)&&d.forEach(_=>i.add(_))}catch{}}return{filesRead:Array.from(r),filesModified:Array.from(i)}}getSessionById(e){return this.db.prepare(`
      SELECT id, claude_session_id, sdk_session_id, project, user_prompt
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}findActiveSDKSession(e){return this.db.prepare(`
      SELECT id, sdk_session_id, project, worker_port
      FROM sdk_sessions
      WHERE claude_session_id = ? AND status = 'active'
      LIMIT 1
    `).get(e)||null}findAnySDKSession(e){return this.db.prepare(`
      SELECT id
      FROM sdk_sessions
      WHERE claude_session_id = ?
      LIMIT 1
    `).get(e)||null}reactivateSession(e,s){this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'active', user_prompt = ?, worker_port = NULL
      WHERE id = ?
    `).run(s,e)}incrementPromptCounter(e){return this.db.prepare(`
      UPDATE sdk_sessions
      SET prompt_counter = COALESCE(prompt_counter, 0) + 1
      WHERE id = ?
    `).run(e),this.db.prepare(`
      SELECT prompt_counter FROM sdk_sessions WHERE id = ?
    `).get(e)?.prompt_counter||1}getPromptCounter(e){return this.db.prepare(`
      SELECT prompt_counter FROM sdk_sessions WHERE id = ?
    `).get(e)?.prompt_counter||0}createSDKSession(e,s,t){let r=new Date,i=r.getTime(),d=this.db.prepare(`
      INSERT OR IGNORE INTO sdk_sessions
      (claude_session_id, sdk_session_id, project, user_prompt, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(e,e,s,t,r.toISOString(),i);return d.lastInsertRowid===0||d.changes===0?this.db.prepare(`
        SELECT id FROM sdk_sessions WHERE claude_session_id = ? LIMIT 1
      `).get(e).id:d.lastInsertRowid}updateSDKSessionId(e,s){return this.db.prepare(`
      UPDATE sdk_sessions
      SET sdk_session_id = ?
      WHERE id = ? AND sdk_session_id IS NULL
    `).run(s,e).changes===0?(H.debug("DB","sdk_session_id already set, skipping update",{sessionId:e,sdkSessionId:s}),!1):!0}setWorkerPort(e,s){this.db.prepare(`
      UPDATE sdk_sessions
      SET worker_port = ?
      WHERE id = ?
    `).run(s,e)}getWorkerPort(e){return this.db.prepare(`
      SELECT worker_port
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)?.worker_port||null}saveUserPrompt(e,s,t){let r=new Date,i=r.getTime();return this.db.prepare(`
      INSERT INTO user_prompts
      (claude_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?)
    `).run(e,s,t,r.toISOString(),i).lastInsertRowid}storeObservation(e,s,t,r){let i=new Date,a=i.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,s,i.toISOString(),a),console.error(`[SessionStore] Auto-created session record for session_id: ${e}`));let b=this.db.prepare(`
      INSERT INTO observations
      (sdk_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.type,t.title,t.subtitle,JSON.stringify(t.facts),t.narrative,JSON.stringify(t.concepts),JSON.stringify(t.files_read),JSON.stringify(t.files_modified),r||null,i.toISOString(),a);return{id:Number(b.lastInsertRowid),createdAtEpoch:a}}storeSummary(e,s,t,r){let i=new Date,a=i.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,s,i.toISOString(),a),console.error(`[SessionStore] Auto-created session record for session_id: ${e}`));let b=this.db.prepare(`
      INSERT INTO session_summaries
      (sdk_session_id, project, request, investigated, learned, completed,
       next_steps, notes, prompt_number, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.request,t.investigated,t.learned,t.completed,t.next_steps,t.notes,r||null,i.toISOString(),a);return{id:Number(b.lastInsertRowid),createdAtEpoch:a}}markSessionCompleted(e){let s=new Date,t=s.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'completed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(s.toISOString(),t,e)}markSessionFailed(e){let s=new Date,t=s.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'failed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(s.toISOString(),t,e)}getSessionSummariesByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r}=s,i=t==="date_asc"?"ASC":"DESC",a=r?`LIMIT ${r}`:"",d=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT * FROM session_summaries
      WHERE id IN (${d})
      ORDER BY created_at_epoch ${i}
      ${a}
    `).all(...e)}getUserPromptsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r}=s,i=t==="date_asc"?"ASC":"DESC",a=r?`LIMIT ${r}`:"",d=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.id IN (${d})
      ORDER BY up.created_at_epoch ${i}
      ${a}
    `).all(...e)}getTimelineAroundTimestamp(e,s=10,t=10,r){return this.getTimelineAroundObservation(null,e,s,t,r)}getTimelineAroundObservation(e,s,t=10,r=10,i){let a=i?"AND project = ?":"",d=i?[i]:[],_,l;if(e!==null){let R=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id <= ? ${a}
        ORDER BY id DESC
        LIMIT ?
      `,O=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id >= ? ${a}
        ORDER BY id ASC
        LIMIT ?
      `;try{let E=this.db.prepare(R).all(e,...d,t+1),c=this.db.prepare(O).all(e,...d,r+1);if(E.length===0&&c.length===0)return{observations:[],sessions:[],prompts:[]};_=E.length>0?E[E.length-1].created_at_epoch:s,l=c.length>0?c[c.length-1].created_at_epoch:s}catch(E){return console.error("[SessionStore] Error getting boundary observations:",E.message),{observations:[],sessions:[],prompts:[]}}}else{let R=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch <= ? ${a}
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `,O=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch >= ? ${a}
        ORDER BY created_at_epoch ASC
        LIMIT ?
      `;try{let E=this.db.prepare(R).all(s,...d,t),c=this.db.prepare(O).all(s,...d,r+1);if(E.length===0&&c.length===0)return{observations:[],sessions:[],prompts:[]};_=E.length>0?E[E.length-1].created_at_epoch:s,l=c.length>0?c[c.length-1].created_at_epoch:s}catch(E){return console.error("[SessionStore] Error getting boundary timestamps:",E.message),{observations:[],sessions:[],prompts:[]}}}let b=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${a}
      ORDER BY created_at_epoch ASC
    `,n=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${a}
      ORDER BY created_at_epoch ASC
    `,A=`
      SELECT up.*, s.project, s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${a.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `;try{let R=this.db.prepare(b).all(_,l,...d),O=this.db.prepare(n).all(_,l,...d),E=this.db.prepare(A).all(_,l,...d);return{observations:R,sessions:O.map(c=>({id:c.id,sdk_session_id:c.sdk_session_id,project:c.project,request:c.request,completed:c.completed,next_steps:c.next_steps,created_at:c.created_at,created_at_epoch:c.created_at_epoch})),prompts:E.map(c=>({id:c.id,claude_session_id:c.claude_session_id,project:c.project,prompt:c.prompt_text,created_at:c.created_at,created_at_epoch:c.created_at_epoch}))}}catch(R){return console.error("[SessionStore] Error querying timeline records:",R.message),{observations:[],sessions:[],prompts:[]}}}storeGitCommit(e,s,t,r,i,a){let d=a||new Date,_=d.getTime();return this.db.prepare(`
      INSERT OR REPLACE INTO git_commits
      (commit_hash, commit_type, subject, project, dim_who, dim_what, dim_when,
       dim_where, dim_why, dim_how, committed_at, committed_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t,r,i.who||null,i.what||null,i.when||null,i.where||null,i.why,i.how,d.toISOString(),_).lastInsertRowid}queryGitCommitsByDimension(e,s,t=50){let r=["project = ?"],i=[e];s.who&&(r.push("dim_who LIKE ?"),i.push(`%${s.who}%`)),s.what&&(r.push("dim_what LIKE ?"),i.push(`%${s.what}%`)),s.when&&(r.push("dim_when LIKE ?"),i.push(`%${s.when}%`)),s.where&&(r.push("dim_where LIKE ?"),i.push(`%${s.where}%`)),s.why&&(r.push("dim_why LIKE ?"),i.push(`%${s.why}%`)),s.how&&(r.push("dim_how LIKE ?"),i.push(`%${s.how}%`)),s.type&&(r.push("commit_type = ?"),i.push(s.type));let a=`
      SELECT * FROM git_commits
      WHERE ${r.join(" AND ")}
      ORDER BY committed_at_epoch DESC
      LIMIT ?
    `;return i.push(t),this.db.prepare(a).all(...i)}queryObservationsByDimension(e,s,t=50){let r=["project = ?"],i=[e];s.who&&(r.push("dim_who LIKE ?"),i.push(`%${s.who}%`)),s.what&&(r.push("dim_what LIKE ?"),i.push(`%${s.what}%`)),s.when&&(r.push("dim_when LIKE ?"),i.push(`%${s.when}%`)),s.where&&(r.push("dim_where LIKE ?"),i.push(`%${s.where}%`)),s.why&&(r.push("dim_why LIKE ?"),i.push(`%${s.why}%`)),s.how&&(r.push("dim_how LIKE ?"),i.push(`%${s.how}%`)),s.type&&(r.push("type = ?"),i.push(s.type));let a=`
      SELECT * FROM observations
      WHERE ${r.join(" AND ")}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;return i.push(t),this.db.prepare(a).all(...i)}tracePurposeChain(e){let s=[],t=e;for(;t!==null;){let i=this.db.prepare(`
        SELECT id, dim_what, dim_why, dilts_level, created_at, parent_observation_id
        FROM observations
        WHERE id = ?
      `).get(t);if(!i)break;s.push({id:i.id,dim_what:i.dim_what,dim_why:i.dim_why,dilts_level:i.dilts_level,created_at:i.created_at}),t=i.parent_observation_id}return s.reverse()}getUniquePurposes(e){return this.db.prepare(`
      SELECT dim_why as why, COUNT(*) as count
      FROM observations
      WHERE project = ? AND dim_why IS NOT NULL
      GROUP BY dim_why
      ORDER BY count DESC
    `).all(e)}getUniqueMethods(e){return this.db.prepare(`
      SELECT dim_how as how, COUNT(*) as count
      FROM observations
      WHERE project = ? AND dim_how IS NOT NULL
      GROUP BY dim_how
      ORDER BY count DESC
    `).all(e)}getValidationHistory(e,s=100){return this.db.prepare(`
      SELECT id, type, dim_what, dim_why, validation_score,
             confidence_what, confidence_why, created_at
      FROM observations
      WHERE project = ? AND validation_score IS NOT NULL
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}close(){this.db.close()}};var te=parseInt(process.env.CLAUDE_MEM_CONTEXT_OBSERVATIONS||"50",10),W=10,o={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"};function re(p){if(!p)return[];let e=JSON.parse(p);return Array.isArray(e)?e:[]}function ie(p){return new Date(p).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function ne(p){return new Date(p).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function oe(p){return new Date(p).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function ae(p){return p?Math.ceil(p.length/4):0}function de(p,e){return X.isAbsolute(p)?X.relative(e,p):p}async function Y(p,e=!1,s=!1){let t=p?.cwd??process.cwd(),r=t?X.basename(t):"unknown-project",i=new D,a=i.db.prepare(`
    SELECT
      id, sdk_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified,
      created_at, created_at_epoch
    FROM observations
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(r,te),d=i.db.prepare(`
    SELECT id, sdk_session_id, request, completed, next_steps, created_at, created_at_epoch
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(r,W+1);if(a.length===0&&d.length===0)return i.close(),e?`
${o.bright}${o.cyan}\u{1F4DD} [${r}] recent context${o.reset}
${o.gray}${"\u2500".repeat(60)}${o.reset}

${o.dim}No previous sessions found for this project yet.${o.reset}
`:`# [${r}] recent context

No previous sessions found for this project yet.`;let _=a,l=d.slice(0,W),b=_,n=[];if(e?(n.push(""),n.push(`${o.bright}${o.cyan}\u{1F4DD} [${r}] recent context${o.reset}`),n.push(`${o.gray}${"\u2500".repeat(60)}${o.reset}`),n.push("")):(n.push(`# [${r}] recent context`),n.push("")),b.length>0){e?(n.push(`${o.dim}Legend: \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u{1F9E0} decision${o.reset}`),n.push("")):(n.push("**Legend:** \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u{1F9E0} decision"),n.push("")),e?(n.push(`${o.dim}\u{1F4A1} Progressive Disclosure: This index shows WHAT exists (titles) and retrieval COST (token counts).${o.reset}`),n.push(`${o.dim}   \u2192 Use MCP search tools to fetch full observation details on-demand (Layer 2)${o.reset}`),n.push(`${o.dim}   \u2192 Prefer searching observations over re-reading code for past decisions and learnings${o.reset}`),n.push(`${o.dim}   \u2192 Critical types (\u{1F534} bugfix, \u{1F9E0} decision) often worth fetching immediately${o.reset}`),n.push("")):(n.push("\u{1F4A1} **Progressive Disclosure:** This index shows WHAT exists (titles) and retrieval COST (token counts)."),n.push("- Use MCP search tools to fetch full observation details on-demand (Layer 2)"),n.push("- Prefer searching observations over re-reading code for past decisions and learnings"),n.push("- Critical types (\u{1F534} bugfix, \u{1F9E0} decision) often worth fetching immediately"),n.push(""));let A=d[0]?.id,R=l.map((m,T)=>{let u=T===0?null:d[T+1];return{...m,displayEpoch:u?u.created_at_epoch:m.created_at_epoch,displayTime:u?u.created_at:m.created_at,isMostRecent:m.id===A}}),O=[...b.map(m=>({type:"observation",data:m})),...R.map(m=>({type:"summary",data:m}))];O.sort((m,T)=>{let u=m.type==="observation"?m.data.created_at_epoch:m.data.displayEpoch,L=T.type==="observation"?T.data.created_at_epoch:T.data.displayEpoch;return u-L});let E=new Map;for(let m of O){let T=m.type==="observation"?m.data.created_at:m.data.displayTime,u=oe(T);E.has(u)||E.set(u,[]),E.get(u).push(m)}let c=Array.from(E.entries()).sort((m,T)=>{let u=new Date(m[0]).getTime(),L=new Date(T[0]).getTime();return u-L});for(let[m,T]of c){e?(n.push(`${o.bright}${o.cyan}${m}${o.reset}`),n.push("")):(n.push(`### ${m}`),n.push(""));let u=null,L="",y=!1;for(let C of T)if(C.type==="summary"){y&&(n.push(""),y=!1,u=null,L="");let h=C.data,v=`${h.request||"Session started"} (${ie(h.displayTime)})`,I=h.isMostRecent?"":`claude-mem://session-summary/${h.id}`;if(e){let g=I?`${o.dim}[${I}]${o.reset}`:"";n.push(`\u{1F3AF} ${o.yellow}#S${h.id}${o.reset} ${v} ${g}`)}else{let g=I?` [\u2192](${I})`:"";n.push(`**\u{1F3AF} #S${h.id}** ${v}${g}`)}n.push("")}else{let h=C.data,v=re(h.files_modified),I=v.length>0?de(v[0],t):"General";I!==u&&(y&&n.push(""),e?n.push(`${o.dim}${I}${o.reset}`):n.push(`**${I}**`),e||(n.push("| ID | Time | T | Title | Tokens |"),n.push("|----|------|---|-------|--------|")),u=I,y=!0,L="");let g="\u2022";switch(h.type){case"bugfix":g="\u{1F534}";break;case"feature":g="\u{1F7E3}";break;case"refactor":g="\u{1F504}";break;case"change":g="\u2705";break;case"discovery":g="\u{1F535}";break;case"decision":g="\u{1F9E0}";break;default:g="\u2022"}let w=ne(h.created_at),F=h.title||"Untitled",x=ae(h.narrative),B=w!==L,V=B?w:"";if(L=w,e){let q=B?`${o.dim}${w}${o.reset}`:" ".repeat(w.length),J=x>0?`${o.dim}(~${x}t)${o.reset}`:"";n.push(`  ${o.dim}#${h.id}${o.reset}  ${q}  ${g}  ${F} ${J}`)}else n.push(`| #${h.id} | ${V||"\u2033"} | ${g} | ${F} | ~${x} |`)}y&&n.push("")}let N=d[0];N&&(N.completed||N.next_steps)&&(N.completed&&(e?n.push(`${o.green}Completed:${o.reset} ${N.completed}`):n.push(`**Completed**: ${N.completed}`),n.push("")),N.next_steps&&(e?n.push(`${o.magenta}Next Steps:${o.reset} ${N.next_steps}`):n.push(`**Next Steps**: ${N.next_steps}`),n.push(""))),e?n.push(`${o.dim}Use claude-mem MCP search to access records with the given ID${o.reset}`):n.push("*Use claude-mem MCP search to access records with the given ID*")}return i.close(),n.join(`
`).trimEnd()}var K=process.argv.includes("--index"),ce=process.argv.includes("--colors");if($.isTTY||ce)Y(void 0,!0,K).then(p=>{console.log(p),process.exit(0)});else{let p="";$.on("data",e=>p+=e),$.on("end",async()=>{let e=p.trim()?JSON.parse(p):void 0,t={hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:await Y(e,!1,K)}};console.log(JSON.stringify(t)),process.exit(0)})}
