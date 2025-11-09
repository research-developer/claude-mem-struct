#!/usr/bin/env node
import{stdin as x}from"process";import P from"better-sqlite3";import{join as m,dirname as X,basename as se}from"path";import{homedir as f}from"os";import{existsSync as ne,mkdirSync as F}from"fs";import{fileURLToPath as B}from"url";function j(){return typeof __dirname<"u"?__dirname:X(B(import.meta.url))}var H=j(),u=process.env.CLAUDE_MEM_DATA_DIR||m(f(),".claude-mem"),S=process.env.CLAUDE_CONFIG_DIR||m(f(),".claude"),ae=m(u,"archives"),de=m(u,"logs"),ce=m(u,"trash"),pe=m(u,"backups"),_e=m(u,"settings.json"),w=m(u,"claude-mem.db"),me=m(u,"vector-db"),Ee=m(S,"settings.json"),ue=m(S,"commands"),le=m(S,"CLAUDE.md");function y(a){F(a,{recursive:!0})}function C(){return m(H,"..","..")}var N=(o=>(o[o.DEBUG=0]="DEBUG",o[o.INFO=1]="INFO",o[o.WARN=2]="WARN",o[o.ERROR=3]="ERROR",o[o.SILENT=4]="SILENT",o))(N||{}),O=class{level;useColor;constructor(){let e=process.env.CLAUDE_MEM_LOG_LEVEL?.toUpperCase()||"INFO";this.level=N[e]??1,this.useColor=process.stdout.isTTY??!1}correlationId(e,s){return`obs-${e}-${s}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.level===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let s=Object.keys(e);return s.length===0?"{}":s.length<=3?JSON.stringify(e):`{${s.length} keys: ${s.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,s){if(!s)return e;try{let t=typeof s=="string"?JSON.parse(s):s;if(e==="Bash"&&t.command){let r=t.command.length>50?t.command.substring(0,50)+"...":t.command;return`${e}(${r})`}if(e==="Read"&&t.file_path){let r=t.file_path.split("/").pop()||t.file_path;return`${e}(${r})`}if(e==="Edit"&&t.file_path){let r=t.file_path.split("/").pop()||t.file_path;return`${e}(${r})`}if(e==="Write"&&t.file_path){let r=t.file_path.split("/").pop()||t.file_path;return`${e}(${r})`}return e}catch{return e}}log(e,s,t,r,o){if(e<this.level)return;let n=new Date().toISOString().replace("T"," ").substring(0,23),i=N[e].padEnd(5),c=s.padEnd(6),_="";r?.correlationId?_=`[${r.correlationId}] `:r?.sessionId&&(_=`[session-${r.sessionId}] `);let E="";o!=null&&(this.level===0&&typeof o=="object"?E=`
`+JSON.stringify(o,null,2):E=" "+this.formatData(o));let T="";if(r){let{sessionId:l,sdkSessionId:h,correlationId:p,...d}=r;Object.keys(d).length>0&&(T=` {${Object.entries(d).map(([k,M])=>`${k}=${M}`).join(", ")}}`)}let R=`[${n}] [${i}] [${c}] ${_}${t}${T}${E}`;e===3?console.error(R):console.log(R)}debug(e,s,t,r){this.log(0,e,s,t,r)}info(e,s,t,r){this.log(1,e,s,t,r)}warn(e,s,t,r){this.log(2,e,s,t,r)}error(e,s,t,r){this.log(3,e,s,t,r)}dataIn(e,s,t,r){this.info(e,`\u2192 ${s}`,t,r)}dataOut(e,s,t,r){this.info(e,`\u2190 ${s}`,t,r)}success(e,s,t,r){this.info(e,`\u2713 ${s}`,t,r)}failure(e,s,t,r){this.error(e,`\u2717 ${s}`,t,r)}timing(e,s,t,r){this.info(e,`\u23F1 ${s}`,r,{duration:`${t}ms`})}},b=new O;var g=class{db;constructor(){y(u),this.db=new P(w),this.db.pragma("journal_mode = WAL"),this.db.pragma("synchronous = NORMAL"),this.db.pragma("foreign_keys = ON"),this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.addDimensionalFields(),this.createGitCommitsTable()}initializeSchema(){try{this.db.exec(`
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
        `),this.db.prepare("INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString()),console.error("[SessionStore] Migration004 applied successfully"))}catch(e){throw console.error("[SessionStore] Schema initialization error:",e.message),e}}ensureWorkerPortColumn(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(5))return;this.db.pragma("table_info(sdk_sessions)").some(r=>r.name==="worker_port")||(this.db.exec("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),console.error("[SessionStore] Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}catch(e){console.error("[SessionStore] Migration error:",e.message)}}ensurePromptTrackingColumns(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(6))return;this.db.pragma("table_info(sdk_sessions)").some(c=>c.name==="prompt_counter")||(this.db.exec("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),console.error("[SessionStore] Added prompt_counter column to sdk_sessions table")),this.db.pragma("table_info(observations)").some(c=>c.name==="prompt_number")||(this.db.exec("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),console.error("[SessionStore] Added prompt_number column to observations table")),this.db.pragma("table_info(session_summaries)").some(c=>c.name==="prompt_number")||(this.db.exec("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),console.error("[SessionStore] Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}catch(e){console.error("[SessionStore] Prompt tracking migration error:",e.message)}}removeSessionSummariesUniqueConstraint(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(7))return;if(!this.db.pragma("index_list(session_summaries)").some(r=>r.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}console.error("[SessionStore] Removing UNIQUE constraint from session_summaries.sdk_session_id..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
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
    `).get(e)||null}getObservationsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r}=s,o=t==="date_asc"?"ASC":"DESC",n=r?`LIMIT ${r}`:"",i=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id IN (${i})
      ORDER BY created_at_epoch ${o}
      ${n}
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
    `).all(e),r=new Set,o=new Set;for(let n of t){if(n.files_read)try{let i=JSON.parse(n.files_read);Array.isArray(i)&&i.forEach(c=>r.add(c))}catch{}if(n.files_modified)try{let i=JSON.parse(n.files_modified);Array.isArray(i)&&i.forEach(c=>o.add(c))}catch{}}return{filesRead:Array.from(r),filesModified:Array.from(o)}}getSessionById(e){return this.db.prepare(`
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
    `).get(e)?.prompt_counter||0}createSDKSession(e,s,t){let r=new Date,o=r.getTime(),i=this.db.prepare(`
      INSERT OR IGNORE INTO sdk_sessions
      (claude_session_id, sdk_session_id, project, user_prompt, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(e,e,s,t,r.toISOString(),o);return i.lastInsertRowid===0||i.changes===0?this.db.prepare(`
        SELECT id FROM sdk_sessions WHERE claude_session_id = ? LIMIT 1
      `).get(e).id:i.lastInsertRowid}updateSDKSessionId(e,s){return this.db.prepare(`
      UPDATE sdk_sessions
      SET sdk_session_id = ?
      WHERE id = ? AND sdk_session_id IS NULL
    `).run(s,e).changes===0?(b.debug("DB","sdk_session_id already set, skipping update",{sessionId:e,sdkSessionId:s}),!1):!0}setWorkerPort(e,s){this.db.prepare(`
      UPDATE sdk_sessions
      SET worker_port = ?
      WHERE id = ?
    `).run(s,e)}getWorkerPort(e){return this.db.prepare(`
      SELECT worker_port
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)?.worker_port||null}saveUserPrompt(e,s,t){let r=new Date,o=r.getTime();return this.db.prepare(`
      INSERT INTO user_prompts
      (claude_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?)
    `).run(e,s,t,r.toISOString(),o).lastInsertRowid}storeObservation(e,s,t,r){let o=new Date,n=o.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,s,o.toISOString(),n),console.error(`[SessionStore] Auto-created session record for session_id: ${e}`));let E=this.db.prepare(`
      INSERT INTO observations
      (sdk_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.type,t.title,t.subtitle,JSON.stringify(t.facts),t.narrative,JSON.stringify(t.concepts),JSON.stringify(t.files_read),JSON.stringify(t.files_modified),r||null,o.toISOString(),n);return{id:Number(E.lastInsertRowid),createdAtEpoch:n}}storeSummary(e,s,t,r){let o=new Date,n=o.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,s,o.toISOString(),n),console.error(`[SessionStore] Auto-created session record for session_id: ${e}`));let E=this.db.prepare(`
      INSERT INTO session_summaries
      (sdk_session_id, project, request, investigated, learned, completed,
       next_steps, notes, prompt_number, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.request,t.investigated,t.learned,t.completed,t.next_steps,t.notes,r||null,o.toISOString(),n);return{id:Number(E.lastInsertRowid),createdAtEpoch:n}}markSessionCompleted(e){let s=new Date,t=s.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'completed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(s.toISOString(),t,e)}markSessionFailed(e){let s=new Date,t=s.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'failed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(s.toISOString(),t,e)}getSessionSummariesByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r}=s,o=t==="date_asc"?"ASC":"DESC",n=r?`LIMIT ${r}`:"",i=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT * FROM session_summaries
      WHERE id IN (${i})
      ORDER BY created_at_epoch ${o}
      ${n}
    `).all(...e)}getUserPromptsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r}=s,o=t==="date_asc"?"ASC":"DESC",n=r?`LIMIT ${r}`:"",i=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.id IN (${i})
      ORDER BY up.created_at_epoch ${o}
      ${n}
    `).all(...e)}getTimelineAroundTimestamp(e,s=10,t=10,r){return this.getTimelineAroundObservation(null,e,s,t,r)}getTimelineAroundObservation(e,s,t=10,r=10,o){let n=o?"AND project = ?":"",i=o?[o]:[],c,_;if(e!==null){let l=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id <= ? ${n}
        ORDER BY id DESC
        LIMIT ?
      `,h=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id >= ? ${n}
        ORDER BY id ASC
        LIMIT ?
      `;try{let p=this.db.prepare(l).all(e,...i,t+1),d=this.db.prepare(h).all(e,...i,r+1);if(p.length===0&&d.length===0)return{observations:[],sessions:[],prompts:[]};c=p.length>0?p[p.length-1].created_at_epoch:s,_=d.length>0?d[d.length-1].created_at_epoch:s}catch(p){return console.error("[SessionStore] Error getting boundary observations:",p.message),{observations:[],sessions:[],prompts:[]}}}else{let l=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch <= ? ${n}
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `,h=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch >= ? ${n}
        ORDER BY created_at_epoch ASC
        LIMIT ?
      `;try{let p=this.db.prepare(l).all(s,...i,t),d=this.db.prepare(h).all(s,...i,r+1);if(p.length===0&&d.length===0)return{observations:[],sessions:[],prompts:[]};c=p.length>0?p[p.length-1].created_at_epoch:s,_=d.length>0?d[d.length-1].created_at_epoch:s}catch(p){return console.error("[SessionStore] Error getting boundary timestamps:",p.message),{observations:[],sessions:[],prompts:[]}}}let E=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${n}
      ORDER BY created_at_epoch ASC
    `,T=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${n}
      ORDER BY created_at_epoch ASC
    `,R=`
      SELECT up.*, s.project, s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${n.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `;try{let l=this.db.prepare(E).all(c,_,...i),h=this.db.prepare(T).all(c,_,...i),p=this.db.prepare(R).all(c,_,...i);return{observations:l,sessions:h.map(d=>({id:d.id,sdk_session_id:d.sdk_session_id,project:d.project,request:d.request,completed:d.completed,next_steps:d.next_steps,created_at:d.created_at,created_at_epoch:d.created_at_epoch})),prompts:p.map(d=>({id:d.id,claude_session_id:d.claude_session_id,project:d.project,prompt:d.prompt_text,created_at:d.created_at,created_at_epoch:d.created_at_epoch}))}}catch(l){return console.error("[SessionStore] Error querying timeline records:",l.message),{observations:[],sessions:[],prompts:[]}}}storeGitCommit(e,s,t,r,o,n){let i=n||new Date,c=i.getTime();return this.db.prepare(`
      INSERT OR REPLACE INTO git_commits
      (commit_hash, commit_type, subject, project, dim_who, dim_what, dim_when,
       dim_where, dim_why, dim_how, committed_at, committed_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t,r,o.who||null,o.what||null,o.when||null,o.where||null,o.why,o.how,i.toISOString(),c).lastInsertRowid}queryGitCommitsByDimension(e,s,t=50){let r=["project = ?"],o=[e];s.who&&(r.push("dim_who LIKE ?"),o.push(`%${s.who}%`)),s.what&&(r.push("dim_what LIKE ?"),o.push(`%${s.what}%`)),s.when&&(r.push("dim_when LIKE ?"),o.push(`%${s.when}%`)),s.where&&(r.push("dim_where LIKE ?"),o.push(`%${s.where}%`)),s.why&&(r.push("dim_why LIKE ?"),o.push(`%${s.why}%`)),s.how&&(r.push("dim_how LIKE ?"),o.push(`%${s.how}%`)),s.type&&(r.push("commit_type = ?"),o.push(s.type));let n=`
      SELECT * FROM git_commits
      WHERE ${r.join(" AND ")}
      ORDER BY committed_at_epoch DESC
      LIMIT ?
    `;return o.push(t),this.db.prepare(n).all(...o)}queryObservationsByDimension(e,s,t=50){let r=["project = ?"],o=[e];s.who&&(r.push("dim_who LIKE ?"),o.push(`%${s.who}%`)),s.what&&(r.push("dim_what LIKE ?"),o.push(`%${s.what}%`)),s.when&&(r.push("dim_when LIKE ?"),o.push(`%${s.when}%`)),s.where&&(r.push("dim_where LIKE ?"),o.push(`%${s.where}%`)),s.why&&(r.push("dim_why LIKE ?"),o.push(`%${s.why}%`)),s.how&&(r.push("dim_how LIKE ?"),o.push(`%${s.how}%`)),s.type&&(r.push("type = ?"),o.push(s.type));let n=`
      SELECT * FROM observations
      WHERE ${r.join(" AND ")}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;return o.push(t),this.db.prepare(n).all(...o)}tracePurposeChain(e){let s=[],t=e;for(;t!==null;){let o=this.db.prepare(`
        SELECT id, dim_what, dim_why, dilts_level, created_at, parent_observation_id
        FROM observations
        WHERE id = ?
      `).get(t);if(!o)break;s.push({id:o.id,dim_what:o.dim_what,dim_why:o.dim_why,dilts_level:o.dilts_level,created_at:o.created_at}),t=o.parent_observation_id}return s.reverse()}getUniquePurposes(e){return this.db.prepare(`
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
    `).all(e,s)}close(){this.db.close()}};function G(a,e,s){return a==="PreCompact"?e?{continue:!0,suppressOutput:!0}:{continue:!1,stopReason:s.reason||"Pre-compact operation failed",suppressOutput:!0}:a==="SessionStart"?e&&s.context?{continue:!0,suppressOutput:!0,hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:s.context}}:{continue:!0,suppressOutput:!0}:a==="UserPromptSubmit"||a==="PostToolUse"?{continue:!0,suppressOutput:!0}:a==="Stop"?{continue:!0,suppressOutput:!0}:{continue:e,suppressOutput:!0,...s.reason&&!e?{stopReason:s.reason}:{}}}function D(a,e,s={}){let t=G(a,e,s);return JSON.stringify(t)}import I from"path";import{homedir as $}from"os";import{existsSync as W,readFileSync as Y}from"fs";import{execSync as K}from"child_process";var V=100,q=100,J=1e4;function L(){try{let a=I.join($(),".claude-mem","settings.json");if(W(a)){let e=JSON.parse(Y(a,"utf-8")),s=parseInt(e.env?.CLAUDE_MEM_WORKER_PORT,10);if(!isNaN(s))return s}}catch{}return parseInt(process.env.CLAUDE_MEM_WORKER_PORT||"37777",10)}async function v(){try{let a=L();return(await fetch(`http://127.0.0.1:${a}/health`,{signal:AbortSignal.timeout(V)})).ok}catch{return!1}}async function Q(){let a=Date.now();for(;Date.now()-a<J;){if(await v())return!0;await new Promise(e=>setTimeout(e,q))}return!1}async function U(){if(await v())return;let a=C(),e=I.join(a,"node_modules",".bin","pm2"),s=I.join(a,"ecosystem.config.cjs");if(K(`"${e}" restart "${s}"`,{cwd:a,stdio:"pipe"}),!await Q())throw new Error("Worker failed to become healthy after restart")}async function z(a){if(!a)throw new Error("summaryHook requires input");let{session_id:e}=a;await U();let s=new g,t=s.createSDKSession(e,"",""),r=s.getPromptCounter(t);s.close();let o=L();b.dataIn("HOOK","Stop: Requesting summary",{sessionId:t,workerPort:o,promptNumber:r});try{let n=await fetch(`http://127.0.0.1:${o}/sessions/${t}/summarize`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt_number:r}),signal:AbortSignal.timeout(2e3)});if(!n.ok){let i=await n.text();throw b.failure("HOOK","Failed to generate summary",{sessionId:t,status:n.status},i),new Error(`Failed to request summary from worker: ${n.status} ${i}`)}b.debug("HOOK","Summary request sent successfully",{sessionId:t})}catch(n){throw n.cause?.code==="ECONNREFUSED"||n.name==="TimeoutError"||n.message.includes("fetch failed")?new Error("There's a problem with the worker. If you just updated, type `pm2 restart claude-mem-worker` in your terminal to continue"):n}finally{await fetch(`http://127.0.0.1:${o}/api/processing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({isProcessing:!1})})}console.log(D("Stop",!0))}var A="";x.on("data",a=>A+=a);x.on("end",async()=>{let a=A?JSON.parse(A):void 0;await z(a)});
