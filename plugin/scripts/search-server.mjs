#!/usr/bin/env node
import{Server as he}from"@modelcontextprotocol/sdk/server/index.js";import{StdioServerTransport as _e}from"@modelcontextprotocol/sdk/server/stdio.js";import{Client as Ee}from"@modelcontextprotocol/sdk/client/index.js";import{StdioClientTransport as fe}from"@modelcontextprotocol/sdk/client/stdio.js";import{CallToolRequestSchema as be,ListToolsRequestSchema as ge}from"@modelcontextprotocol/sdk/types.js";import{z as a}from"zod";import{zodToJsonSchema as Te}from"zod-to-json-schema";import{basename as ye}from"path";import pe from"better-sqlite3";import{join as x,dirname as ce,basename as we}from"path";import{homedir as ee}from"os";import{existsSync as Ce,mkdirSync as de}from"fs";import{fileURLToPath as ue}from"url";function le(){return typeof __dirname<"u"?__dirname:ce(ue(import.meta.url))}var $e=le(),D=process.env.CLAUDE_MEM_DATA_DIR||x(ee(),".claude-mem"),V=process.env.CLAUDE_CONFIG_DIR||x(ee(),".claude"),Fe=x(D,"archives"),Ue=x(D,"logs"),ke=x(D,"trash"),Me=x(D,"backups"),je=x(D,"settings.json"),H=x(D,"claude-mem.db"),te=x(D,"vector-db"),Be=x(V,"settings.json"),He=x(V,"commands"),Xe=x(V,"CLAUDE.md");function X(d){de(d,{recursive:!0})}var W=class{db;constructor(e){e||(X(D),e=H),this.db=new pe(e),this.db.pragma("journal_mode = WAL"),this.ensureFTSTables()}ensureFTSTables(){try{if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'").all().some(n=>n.name==="observations_fts"||n.name==="session_summaries_fts"))return;console.error("[SessionSearch] Creating FTS5 tables..."),this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
          title,
          subtitle,
          narrative,
          text,
          facts,
          concepts,
          content='observations',
          content_rowid='id'
        );
      `),this.db.exec(`
        INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
        SELECT id, title, subtitle, narrative, text, facts, concepts
        FROM observations;
      `),this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
          INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
          VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
        END;

        CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
          INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
          VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
        END;

        CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
          INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
          VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
          INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
          VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
        END;
      `),this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
          request,
          investigated,
          learned,
          completed,
          next_steps,
          notes,
          content='session_summaries',
          content_rowid='id'
        );
      `),this.db.exec(`
        INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
        SELECT id, request, investigated, learned, completed, next_steps, notes
        FROM session_summaries;
      `),this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
          INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
          VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
        END;

        CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
          INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
          VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
        END;

        CREATE TRIGGER IF NOT EXISTS session_summaries_au AFTER UPDATE ON session_summaries BEGIN
          INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
          VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
          INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
          VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
        END;
      `),console.error("[SessionSearch] FTS5 tables created successfully")}catch(e){console.error("[SessionSearch] FTS migration error:",e.message)}}escapeFTS5(e){return`"${e.replace(/"/g,'""')}"`}buildFilterClause(e,t,n="o"){let s=[];if(e.project&&(s.push(`${n}.project = ?`),t.push(e.project)),e.type)if(Array.isArray(e.type)){let r=e.type.map(()=>"?").join(",");s.push(`${n}.type IN (${r})`),t.push(...e.type)}else s.push(`${n}.type = ?`),t.push(e.type);if(e.dateRange){let{start:r,end:o}=e.dateRange;if(r){let i=typeof r=="number"?r:new Date(r).getTime();s.push(`${n}.created_at_epoch >= ?`),t.push(i)}if(o){let i=typeof o=="number"?o:new Date(o).getTime();s.push(`${n}.created_at_epoch <= ?`),t.push(i)}}if(e.concepts){let r=Array.isArray(e.concepts)?e.concepts:[e.concepts],o=r.map(()=>`EXISTS (SELECT 1 FROM json_each(${n}.concepts) WHERE value = ?)`);o.length>0&&(s.push(`(${o.join(" OR ")})`),t.push(...r))}if(e.files){let r=Array.isArray(e.files)?e.files:[e.files],o=r.map(()=>`(
          EXISTS (SELECT 1 FROM json_each(${n}.files_read) WHERE value LIKE ?)
          OR EXISTS (SELECT 1 FROM json_each(${n}.files_modified) WHERE value LIKE ?)
        )`);o.length>0&&(s.push(`(${o.join(" OR ")})`),r.forEach(i=>{t.push(`%${i}%`,`%${i}%`)}))}return s.length>0?s.join(" AND "):""}buildOrderClause(e="relevance",t=!0,n="observations_fts"){switch(e){case"relevance":return t?`ORDER BY ${n}.rank ASC`:"ORDER BY o.created_at_epoch DESC";case"date_desc":return"ORDER BY o.created_at_epoch DESC";case"date_asc":return"ORDER BY o.created_at_epoch ASC";default:return"ORDER BY o.created_at_epoch DESC"}}searchObservations(e,t={}){let n=[],{limit:s=50,offset:r=0,orderBy:o="relevance",...i}=t,u=this.escapeFTS5(e);n.push(u);let c=this.buildFilterClause(i,n,"o"),p=c?`AND ${c}`:"",l=this.buildOrderClause(o,!0),m=`
      SELECT
        o.*,
        observations_fts.rank as rank
      FROM observations o
      JOIN observations_fts ON o.id = observations_fts.rowid
      WHERE observations_fts MATCH ?
      ${p}
      ${l}
      LIMIT ? OFFSET ?
    `;n.push(s,r);let E=this.db.prepare(m).all(...n);if(E.length>0){let h=Math.min(...E.map(f=>f.rank||0)),_=Math.max(...E.map(f=>f.rank||0))-h||1;E.forEach(f=>{f.rank!==void 0&&(f.score=1-(f.rank-h)/_)})}return E}searchSessions(e,t={}){let n=[],{limit:s=50,offset:r=0,orderBy:o="relevance",...i}=t,u=this.escapeFTS5(e);n.push(u);let c={...i};delete c.type;let p=this.buildFilterClause(c,n,"s"),h=`
      SELECT
        s.*,
        session_summaries_fts.rank as rank
      FROM session_summaries s
      JOIN session_summaries_fts ON s.id = session_summaries_fts.rowid
      WHERE session_summaries_fts MATCH ?
      ${(p?`AND ${p}`:"").replace(/files_read/g,"files_read").replace(/files_modified/g,"files_edited")}
      ${o==="relevance"?"ORDER BY session_summaries_fts.rank ASC":o==="date_asc"?"ORDER BY s.created_at_epoch ASC":"ORDER BY s.created_at_epoch DESC"}
      LIMIT ? OFFSET ?
    `;n.push(s,r);let b=this.db.prepare(h).all(...n);if(b.length>0){let _=Math.min(...b.map(T=>T.rank||0)),w=Math.max(...b.map(T=>T.rank||0))-_||1;b.forEach(T=>{T.rank!==void 0&&(T.score=1-(T.rank-_)/w)})}return b}findByConcept(e,t={}){let n=[],{limit:s=50,offset:r=0,orderBy:o="date_desc",...i}=t,u={...i,concepts:e},c=this.buildFilterClause(u,n,"o"),p=this.buildOrderClause(o,!1),l=`
      SELECT o.*
      FROM observations o
      WHERE ${c}
      ${p}
      LIMIT ? OFFSET ?
    `;return n.push(s,r),this.db.prepare(l).all(...n)}findByFile(e,t={}){let n=[],{limit:s=50,offset:r=0,orderBy:o="date_desc",...i}=t,u={...i,files:e},c=this.buildFilterClause(u,n,"o"),p=this.buildOrderClause(o,!1),l=`
      SELECT o.*
      FROM observations o
      WHERE ${c}
      ${p}
      LIMIT ? OFFSET ?
    `;n.push(s,r);let m=this.db.prepare(l).all(...n),E=[],h={...i};delete h.type;let b=[];if(h.project&&(b.push("s.project = ?"),E.push(h.project)),h.dateRange){let{start:w,end:T}=h.dateRange;if(w){let g=typeof w=="number"?w:new Date(w).getTime();b.push("s.created_at_epoch >= ?"),E.push(g)}if(T){let g=typeof T=="number"?T:new Date(T).getTime();b.push("s.created_at_epoch <= ?"),E.push(g)}}b.push(`(
      EXISTS (SELECT 1 FROM json_each(s.files_read) WHERE value LIKE ?)
      OR EXISTS (SELECT 1 FROM json_each(s.files_edited) WHERE value LIKE ?)
    )`),E.push(`%${e}%`,`%${e}%`);let _=`
      SELECT s.*
      FROM session_summaries s
      WHERE ${b.join(" AND ")}
      ORDER BY s.created_at_epoch DESC
      LIMIT ? OFFSET ?
    `;E.push(s,r);let f=this.db.prepare(_).all(...E);return{observations:m,sessions:f}}findByType(e,t={}){let n=[],{limit:s=50,offset:r=0,orderBy:o="date_desc",...i}=t,u={...i,type:e},c=this.buildFilterClause(u,n,"o"),p=this.buildOrderClause(o,!1),l=`
      SELECT o.*
      FROM observations o
      WHERE ${c}
      ${p}
      LIMIT ? OFFSET ?
    `;return n.push(s,r),this.db.prepare(l).all(...n)}searchUserPrompts(e,t={}){let n=[],{limit:s=20,offset:r=0,orderBy:o="relevance",...i}=t,u=this.escapeFTS5(e);n.push(u);let c=[];if(i.project&&(c.push("s.project = ?"),n.push(i.project)),i.dateRange){let{start:h,end:b}=i.dateRange;if(h){let _=typeof h=="number"?h:new Date(h).getTime();c.push("up.created_at_epoch >= ?"),n.push(_)}if(b){let _=typeof b=="number"?b:new Date(b).getTime();c.push("up.created_at_epoch <= ?"),n.push(_)}}let m=`
      SELECT
        up.*,
        user_prompts_fts.rank as rank
      FROM user_prompts up
      JOIN user_prompts_fts ON up.id = user_prompts_fts.rowid
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE user_prompts_fts MATCH ?
      ${c.length>0?`AND ${c.join(" AND ")}`:""}
      ${o==="relevance"?"ORDER BY user_prompts_fts.rank ASC":o==="date_asc"?"ORDER BY up.created_at_epoch ASC":"ORDER BY up.created_at_epoch DESC"}
      LIMIT ? OFFSET ?
    `;n.push(s,r);let E=this.db.prepare(m).all(...n);if(E.length>0){let h=Math.min(...E.map(f=>f.rank||0)),_=Math.max(...E.map(f=>f.rank||0))-h||1;E.forEach(f=>{f.rank!==void 0&&(f.score=1-(f.rank-h)/_)})}return E}getUserPromptsBySession(e){return this.db.prepare(`
      SELECT
        id,
        claude_session_id,
        prompt_number,
        prompt_text,
        created_at,
        created_at_epoch
      FROM user_prompts
      WHERE claude_session_id = ?
      ORDER BY prompt_number ASC
    `).all(e)}close(){this.db.close()}};import me from"better-sqlite3";var K=(r=>(r[r.DEBUG=0]="DEBUG",r[r.INFO=1]="INFO",r[r.WARN=2]="WARN",r[r.ERROR=3]="ERROR",r[r.SILENT=4]="SILENT",r))(K||{}),Q=class{level;useColor;constructor(){let e=process.env.CLAUDE_MEM_LOG_LEVEL?.toUpperCase()||"INFO";this.level=K[e]??1,this.useColor=process.stdout.isTTY??!1}correlationId(e,t){return`obs-${e}-${t}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.level===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let t=Object.keys(e);return t.length===0?"{}":t.length<=3?JSON.stringify(e):`{${t.length} keys: ${t.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,t){if(!t)return e;try{let n=typeof t=="string"?JSON.parse(t):t;if(e==="Bash"&&n.command){let s=n.command.length>50?n.command.substring(0,50)+"...":n.command;return`${e}(${s})`}if(e==="Read"&&n.file_path){let s=n.file_path.split("/").pop()||n.file_path;return`${e}(${s})`}if(e==="Edit"&&n.file_path){let s=n.file_path.split("/").pop()||n.file_path;return`${e}(${s})`}if(e==="Write"&&n.file_path){let s=n.file_path.split("/").pop()||n.file_path;return`${e}(${s})`}return e}catch{return e}}log(e,t,n,s,r){if(e<this.level)return;let o=new Date().toISOString().replace("T"," ").substring(0,23),i=K[e].padEnd(5),u=t.padEnd(6),c="";s?.correlationId?c=`[${s.correlationId}] `:s?.sessionId&&(c=`[session-${s.sessionId}] `);let p="";r!=null&&(this.level===0&&typeof r=="object"?p=`
`+JSON.stringify(r,null,2):p=" "+this.formatData(r));let l="";if(s){let{sessionId:E,sdkSessionId:h,correlationId:b,..._}=s;Object.keys(_).length>0&&(l=` {${Object.entries(_).map(([w,T])=>`${w}=${T}`).join(", ")}}`)}let m=`[${o}] [${i}] [${u}] ${c}${n}${l}${p}`;e===3?console.error(m):console.log(m)}debug(e,t,n,s){this.log(0,e,t,n,s)}info(e,t,n,s){this.log(1,e,t,n,s)}warn(e,t,n,s){this.log(2,e,t,n,s)}error(e,t,n,s){this.log(3,e,t,n,s)}dataIn(e,t,n,s){this.info(e,`\u2192 ${t}`,n,s)}dataOut(e,t,n,s){this.info(e,`\u2190 ${t}`,n,s)}success(e,t,n,s){this.info(e,`\u2713 ${t}`,n,s)}failure(e,t,n,s){this.error(e,`\u2717 ${t}`,n,s)}timing(e,t,n,s){this.info(e,`\u23F1 ${t}`,s,{duration:`${n}ms`})}},se=new Q;var G=class{db;constructor(){X(D),this.db=new me(H),this.db.pragma("journal_mode = WAL"),this.db.pragma("synchronous = NORMAL"),this.db.pragma("foreign_keys = ON"),this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.addDimensionalFields(),this.createGitCommitsTable()}initializeSchema(){try{this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_versions (
          id INTEGER PRIMARY KEY,
          version INTEGER UNIQUE NOT NULL,
          applied_at TEXT NOT NULL
        )
      `);let e=this.db.prepare("SELECT version FROM schema_versions ORDER BY version").all();(e.length>0?Math.max(...e.map(n=>n.version)):0)===0&&(console.error("[SessionStore] Initializing fresh database with migration004..."),this.db.exec(`
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
        `),this.db.prepare("INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString()),console.error("[SessionStore] Migration004 applied successfully"))}catch(e){throw console.error("[SessionStore] Schema initialization error:",e.message),e}}ensureWorkerPortColumn(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(5))return;this.db.pragma("table_info(sdk_sessions)").some(s=>s.name==="worker_port")||(this.db.exec("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),console.error("[SessionStore] Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}catch(e){console.error("[SessionStore] Migration error:",e.message)}}ensurePromptTrackingColumns(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(6))return;this.db.pragma("table_info(sdk_sessions)").some(u=>u.name==="prompt_counter")||(this.db.exec("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),console.error("[SessionStore] Added prompt_counter column to sdk_sessions table")),this.db.pragma("table_info(observations)").some(u=>u.name==="prompt_number")||(this.db.exec("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),console.error("[SessionStore] Added prompt_number column to observations table")),this.db.pragma("table_info(session_summaries)").some(u=>u.name==="prompt_number")||(this.db.exec("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),console.error("[SessionStore] Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}catch(e){console.error("[SessionStore] Prompt tracking migration error:",e.message)}}removeSessionSummariesUniqueConstraint(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(7))return;if(!this.db.pragma("index_list(session_summaries)").some(s=>s.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}console.error("[SessionStore] Removing UNIQUE constraint from session_summaries.sdk_session_id..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
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
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),console.error("[SessionStore] Successfully removed UNIQUE constraint from session_summaries.sdk_session_id")}catch(s){throw this.db.exec("ROLLBACK"),s}}catch(e){console.error("[SessionStore] Migration error (remove UNIQUE constraint):",e.message)}}addObservationHierarchicalFields(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.pragma("table_info(observations)").some(s=>s.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}console.error("[SessionStore] Adding hierarchical fields to observations table..."),this.db.exec(`
        ALTER TABLE observations ADD COLUMN title TEXT;
        ALTER TABLE observations ADD COLUMN subtitle TEXT;
        ALTER TABLE observations ADD COLUMN facts TEXT;
        ALTER TABLE observations ADD COLUMN narrative TEXT;
        ALTER TABLE observations ADD COLUMN concepts TEXT;
        ALTER TABLE observations ADD COLUMN files_read TEXT;
        ALTER TABLE observations ADD COLUMN files_modified TEXT;
      `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),console.error("[SessionStore] Successfully added hierarchical fields to observations table")}catch(e){console.error("[SessionStore] Migration error (add hierarchical fields):",e.message)}}makeObservationsTextNullable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let n=this.db.pragma("table_info(observations)").find(s=>s.name==="text");if(!n||n.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}console.error("[SessionStore] Making observations.text nullable..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
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
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),console.error("[SessionStore] Successfully made observations.text nullable")}catch(s){throw this.db.exec("ROLLBACK"),s}}catch(e){console.error("[SessionStore] Migration error (make text nullable):",e.message)}}createUserPromptsTable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.pragma("table_info(user_prompts)").length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}console.error("[SessionStore] Creating user_prompts table with FTS5 support..."),this.db.exec("BEGIN TRANSACTION");try{this.db.exec(`
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
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),console.error("[SessionStore] Successfully created user_prompts table with FTS5 support")}catch(n){throw this.db.exec("ROLLBACK"),n}}catch(e){console.error("[SessionStore] Migration error (create user_prompts table):",e.message)}}addDimensionalFields(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;if(this.db.pragma("table_info(observations)").some(s=>s.name==="dim_why")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString());return}console.error("[SessionStore] Adding SixSpec dimensional fields..."),this.db.exec(`
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
        `),this.db.exec("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(12,new Date().toISOString()),console.error("[SessionStore] Successfully created git_commits table with FTS5 support")}catch(n){throw this.db.exec("ROLLBACK"),n}}catch(e){console.error("[SessionStore] Migration error (create git_commits table):",e.message)}}getRecentSummaries(e,t=10){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}getRecentSummariesWithSessionInfo(e,t=3){return this.db.prepare(`
      SELECT
        sdk_session_id, request, learned, completed, next_steps,
        prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}getRecentObservations(e,t=20){return this.db.prepare(`
      SELECT type, text, prompt_number, created_at
      FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}getAllRecentObservations(e=100){return this.db.prepare(`
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
    `).all().map(n=>n.project)}getRecentSessionsWithStatus(e,t=3){return this.db.prepare(`
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
    `).all(e,t)}getObservationsForSession(e){return this.db.prepare(`
      SELECT title, subtitle, type, prompt_number
      FROM observations
      WHERE sdk_session_id = ?
      ORDER BY created_at_epoch ASC
    `).all(e)}getObservationById(e){return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id = ?
    `).get(e)||null}getObservationsByIds(e,t={}){if(e.length===0)return[];let{orderBy:n="date_desc",limit:s}=t,r=n==="date_asc"?"ASC":"DESC",o=s?`LIMIT ${s}`:"",i=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id IN (${i})
      ORDER BY created_at_epoch ${r}
      ${o}
    `).all(...e)}getSummaryForSession(e){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE sdk_session_id = ?
      ORDER BY created_at_epoch DESC
      LIMIT 1
    `).get(e)||null}getFilesForSession(e){let n=this.db.prepare(`
      SELECT files_read, files_modified
      FROM observations
      WHERE sdk_session_id = ?
    `).all(e),s=new Set,r=new Set;for(let o of n){if(o.files_read)try{let i=JSON.parse(o.files_read);Array.isArray(i)&&i.forEach(u=>s.add(u))}catch{}if(o.files_modified)try{let i=JSON.parse(o.files_modified);Array.isArray(i)&&i.forEach(u=>r.add(u))}catch{}}return{filesRead:Array.from(s),filesModified:Array.from(r)}}getSessionById(e){return this.db.prepare(`
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
    `).get(e)||null}reactivateSession(e,t){this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'active', user_prompt = ?, worker_port = NULL
      WHERE id = ?
    `).run(t,e)}incrementPromptCounter(e){return this.db.prepare(`
      UPDATE sdk_sessions
      SET prompt_counter = COALESCE(prompt_counter, 0) + 1
      WHERE id = ?
    `).run(e),this.db.prepare(`
      SELECT prompt_counter FROM sdk_sessions WHERE id = ?
    `).get(e)?.prompt_counter||1}getPromptCounter(e){return this.db.prepare(`
      SELECT prompt_counter FROM sdk_sessions WHERE id = ?
    `).get(e)?.prompt_counter||0}createSDKSession(e,t,n){let s=new Date,r=s.getTime(),i=this.db.prepare(`
      INSERT OR IGNORE INTO sdk_sessions
      (claude_session_id, sdk_session_id, project, user_prompt, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(e,e,t,n,s.toISOString(),r);return i.lastInsertRowid===0||i.changes===0?this.db.prepare(`
        SELECT id FROM sdk_sessions WHERE claude_session_id = ? LIMIT 1
      `).get(e).id:i.lastInsertRowid}updateSDKSessionId(e,t){return this.db.prepare(`
      UPDATE sdk_sessions
      SET sdk_session_id = ?
      WHERE id = ? AND sdk_session_id IS NULL
    `).run(t,e).changes===0?(se.debug("DB","sdk_session_id already set, skipping update",{sessionId:e,sdkSessionId:t}),!1):!0}setWorkerPort(e,t){this.db.prepare(`
      UPDATE sdk_sessions
      SET worker_port = ?
      WHERE id = ?
    `).run(t,e)}getWorkerPort(e){return this.db.prepare(`
      SELECT worker_port
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)?.worker_port||null}saveUserPrompt(e,t,n){let s=new Date,r=s.getTime();return this.db.prepare(`
      INSERT INTO user_prompts
      (claude_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?)
    `).run(e,t,n,s.toISOString(),r).lastInsertRowid}storeObservation(e,t,n,s){let r=new Date,o=r.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,t,r.toISOString(),o),console.error(`[SessionStore] Auto-created session record for session_id: ${e}`));let p=this.db.prepare(`
      INSERT INTO observations
      (sdk_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,t,n.type,n.title,n.subtitle,JSON.stringify(n.facts),n.narrative,JSON.stringify(n.concepts),JSON.stringify(n.files_read),JSON.stringify(n.files_modified),s||null,r.toISOString(),o);return{id:Number(p.lastInsertRowid),createdAtEpoch:o}}storeSummary(e,t,n,s){let r=new Date,o=r.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,t,r.toISOString(),o),console.error(`[SessionStore] Auto-created session record for session_id: ${e}`));let p=this.db.prepare(`
      INSERT INTO session_summaries
      (sdk_session_id, project, request, investigated, learned, completed,
       next_steps, notes, prompt_number, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,s||null,r.toISOString(),o);return{id:Number(p.lastInsertRowid),createdAtEpoch:o}}markSessionCompleted(e){let t=new Date,n=t.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'completed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(t.toISOString(),n,e)}markSessionFailed(e){let t=new Date,n=t.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'failed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(t.toISOString(),n,e)}getSessionSummariesByIds(e,t={}){if(e.length===0)return[];let{orderBy:n="date_desc",limit:s}=t,r=n==="date_asc"?"ASC":"DESC",o=s?`LIMIT ${s}`:"",i=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT * FROM session_summaries
      WHERE id IN (${i})
      ORDER BY created_at_epoch ${r}
      ${o}
    `).all(...e)}getUserPromptsByIds(e,t={}){if(e.length===0)return[];let{orderBy:n="date_desc",limit:s}=t,r=n==="date_asc"?"ASC":"DESC",o=s?`LIMIT ${s}`:"",i=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.id IN (${i})
      ORDER BY up.created_at_epoch ${r}
      ${o}
    `).all(...e)}getTimelineAroundTimestamp(e,t=10,n=10,s){return this.getTimelineAroundObservation(null,e,t,n,s)}getTimelineAroundObservation(e,t,n=10,s=10,r){let o=r?"AND project = ?":"",i=r?[r]:[],u,c;if(e!==null){let E=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id <= ? ${o}
        ORDER BY id DESC
        LIMIT ?
      `,h=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id >= ? ${o}
        ORDER BY id ASC
        LIMIT ?
      `;try{let b=this.db.prepare(E).all(e,...i,n+1),_=this.db.prepare(h).all(e,...i,s+1);if(b.length===0&&_.length===0)return{observations:[],sessions:[],prompts:[]};u=b.length>0?b[b.length-1].created_at_epoch:t,c=_.length>0?_[_.length-1].created_at_epoch:t}catch(b){return console.error("[SessionStore] Error getting boundary observations:",b.message),{observations:[],sessions:[],prompts:[]}}}else{let E=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch <= ? ${o}
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `,h=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch >= ? ${o}
        ORDER BY created_at_epoch ASC
        LIMIT ?
      `;try{let b=this.db.prepare(E).all(t,...i,n),_=this.db.prepare(h).all(t,...i,s+1);if(b.length===0&&_.length===0)return{observations:[],sessions:[],prompts:[]};u=b.length>0?b[b.length-1].created_at_epoch:t,c=_.length>0?_[_.length-1].created_at_epoch:t}catch(b){return console.error("[SessionStore] Error getting boundary timestamps:",b.message),{observations:[],sessions:[],prompts:[]}}}let p=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${o}
      ORDER BY created_at_epoch ASC
    `,l=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${o}
      ORDER BY created_at_epoch ASC
    `,m=`
      SELECT up.*, s.project, s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${o.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `;try{let E=this.db.prepare(p).all(u,c,...i),h=this.db.prepare(l).all(u,c,...i),b=this.db.prepare(m).all(u,c,...i);return{observations:E,sessions:h.map(_=>({id:_.id,sdk_session_id:_.sdk_session_id,project:_.project,request:_.request,completed:_.completed,next_steps:_.next_steps,created_at:_.created_at,created_at_epoch:_.created_at_epoch})),prompts:b.map(_=>({id:_.id,claude_session_id:_.claude_session_id,project:_.project,prompt:_.prompt_text,created_at:_.created_at,created_at_epoch:_.created_at_epoch}))}}catch(E){return console.error("[SessionStore] Error querying timeline records:",E.message),{observations:[],sessions:[],prompts:[]}}}storeGitCommit(e,t,n,s,r,o){let i=o||new Date,u=i.getTime();return this.db.prepare(`
      INSERT OR REPLACE INTO git_commits
      (commit_hash, commit_type, subject, project, dim_who, dim_what, dim_when,
       dim_where, dim_why, dim_how, committed_at, committed_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,t,n,s,r.who||null,r.what||null,r.when||null,r.where||null,r.why,r.how,i.toISOString(),u).lastInsertRowid}queryGitCommitsByDimension(e,t,n=50){let s=["project = ?"],r=[e];t.who&&(s.push("dim_who LIKE ?"),r.push(`%${t.who}%`)),t.what&&(s.push("dim_what LIKE ?"),r.push(`%${t.what}%`)),t.when&&(s.push("dim_when LIKE ?"),r.push(`%${t.when}%`)),t.where&&(s.push("dim_where LIKE ?"),r.push(`%${t.where}%`)),t.why&&(s.push("dim_why LIKE ?"),r.push(`%${t.why}%`)),t.how&&(s.push("dim_how LIKE ?"),r.push(`%${t.how}%`)),t.type&&(s.push("commit_type = ?"),r.push(t.type));let o=`
      SELECT * FROM git_commits
      WHERE ${s.join(" AND ")}
      ORDER BY committed_at_epoch DESC
      LIMIT ?
    `;return r.push(n),this.db.prepare(o).all(...r)}queryObservationsByDimension(e,t,n=50){let s=["project = ?"],r=[e];t.who&&(s.push("dim_who LIKE ?"),r.push(`%${t.who}%`)),t.what&&(s.push("dim_what LIKE ?"),r.push(`%${t.what}%`)),t.when&&(s.push("dim_when LIKE ?"),r.push(`%${t.when}%`)),t.where&&(s.push("dim_where LIKE ?"),r.push(`%${t.where}%`)),t.why&&(s.push("dim_why LIKE ?"),r.push(`%${t.why}%`)),t.how&&(s.push("dim_how LIKE ?"),r.push(`%${t.how}%`)),t.type&&(s.push("type = ?"),r.push(t.type));let o=`
      SELECT * FROM observations
      WHERE ${s.join(" AND ")}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;return r.push(n),this.db.prepare(o).all(...r)}tracePurposeChain(e){let t=[],n=e;for(;n!==null;){let r=this.db.prepare(`
        SELECT id, dim_what, dim_why, dilts_level, created_at, parent_observation_id
        FROM observations
        WHERE id = ?
      `).get(n);if(!r)break;t.push({id:r.id,dim_what:r.dim_what,dim_why:r.dim_why,dilts_level:r.dilts_level,created_at:r.created_at}),n=r.parent_observation_id}return t.reverse()}getUniquePurposes(e){return this.db.prepare(`
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
    `).all(e)}getValidationHistory(e,t=100){return this.db.prepare(`
      SELECT id, type, dim_what, dim_why, validation_score,
             confidence_what, confidence_why, created_at
      FROM observations
      WHERE project = ? AND validation_score IS NOT NULL
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}close(){this.db.close()}};var $,v,F=null,Se="cm__claude-mem";try{$=new W,v=new G}catch(d){console.error("[search-server] Failed to initialize search:",d.message),process.exit(1)}async function M(d,e,t){if(!F)throw new Error("Chroma client not initialized");let s=(await F.callTool({name:"chroma_query_documents",arguments:{collection_name:Se,query_texts:[d],n_results:e,include:["documents","metadatas","distances"],where:t}})).content[0]?.text||"",r;try{r=JSON.parse(s)}catch(p){return console.error("[search-server] Failed to parse Chroma response as JSON:",p),{ids:[],distances:[],metadatas:[]}}let o=[],i=r.ids?.[0]||[];for(let p of i){let l=p.match(/obs_(\d+)_/),m=p.match(/summary_(\d+)_/),E=p.match(/prompt_(\d+)/),h=null;l?h=parseInt(l[1],10):m?h=parseInt(m[1],10):E&&(h=parseInt(E[1],10)),h!==null&&!o.includes(h)&&o.push(h)}let u=r.distances?.[0]||[],c=r.metadatas?.[0]||[];return{ids:o,distances:u,metadatas:c}}function j(){return`
---
\u{1F4A1} Search Strategy:
ALWAYS search with index format FIRST to get an overview and identify relevant results.
This is critical for token efficiency - index format uses ~10x fewer tokens than full format.

Search workflow:
1. Initial search: Use default (index) format to see titles, dates, and sources
2. Review results: Identify which items are most relevant to your needs
3. Deep dive: Only then use format: "full" on specific items of interest
4. Narrow down: Use filters (type, dateRange, concepts, files) to refine results

Other tips:
\u2022 To search by concept: Use find_by_concept tool
\u2022 To browse by type: Use find_by_type with ["decision", "feature", etc.]
\u2022 To sort by date: Use orderBy: "date_desc" or "date_asc"`}function P(d,e){let t=d.title||`Observation #${d.id}`,n=new Date(d.created_at_epoch).toLocaleString(),s=d.type?`[${d.type}]`:"";return`${e+1}. ${s} ${t}
   Date: ${n}
   Source: claude-mem://observation/${d.id}`}function re(d,e){let t=d.request||`Session ${d.sdk_session_id.substring(0,8)}`,n=new Date(d.created_at_epoch).toLocaleString();return`${e+1}. ${t}
   Date: ${n}
   Source: claude-mem://session/${d.sdk_session_id}`}function q(d){let e=d.title||`Observation #${d.id}`,t=[];t.push(`## ${e}`),t.push(`*Source: claude-mem://observation/${d.id}*`),t.push(""),d.subtitle&&(t.push(`**${d.subtitle}**`),t.push("")),d.narrative&&(t.push(d.narrative),t.push("")),d.text&&(t.push(d.text),t.push(""));let n=[];if(n.push(`Type: ${d.type}`),d.facts)try{let r=JSON.parse(d.facts);r.length>0&&n.push(`Facts: ${r.join("; ")}`)}catch{}if(d.concepts)try{let r=JSON.parse(d.concepts);r.length>0&&n.push(`Concepts: ${r.join(", ")}`)}catch{}if(d.files_read||d.files_modified){let r=[];if(d.files_read)try{r.push(...JSON.parse(d.files_read))}catch{}if(d.files_modified)try{r.push(...JSON.parse(d.files_modified))}catch{}r.length>0&&n.push(`Files: ${[...new Set(r)].join(", ")}`)}n.length>0&&(t.push("---"),t.push(n.join(" | ")));let s=new Date(d.created_at_epoch).toLocaleString();return t.push(""),t.push("---"),t.push(`Date: ${s}`),t.join(`
`)}function ne(d){let e=d.request||`Session ${d.sdk_session_id.substring(0,8)}`,t=[];t.push(`## ${e}`),t.push(`*Source: claude-mem://session/${d.sdk_session_id}*`),t.push(""),d.completed&&(t.push(`**Completed:** ${d.completed}`),t.push("")),d.learned&&(t.push(`**Learned:** ${d.learned}`),t.push("")),d.investigated&&(t.push(`**Investigated:** ${d.investigated}`),t.push("")),d.next_steps&&(t.push(`**Next Steps:** ${d.next_steps}`),t.push("")),d.notes&&(t.push(`**Notes:** ${d.notes}`),t.push(""));let n=[];if(d.files_read||d.files_edited){let r=[];if(d.files_read)try{r.push(...JSON.parse(d.files_read))}catch{}if(d.files_edited)try{r.push(...JSON.parse(d.files_edited))}catch{}r.length>0&&n.push(`Files: ${[...new Set(r)].join(", ")}`)}let s=new Date(d.created_at_epoch).toLocaleDateString();return n.push(`Date: ${s}`),n.length>0&&(t.push("---"),t.push(n.join(" | "))),t.join(`
`)}function Re(d,e){let t=new Date(d.created_at_epoch).toLocaleString();return`${e+1}. "${d.prompt_text}"
   Date: ${t} | Prompt #${d.prompt_number}
   Source: claude-mem://user-prompt/${d.id}`}function ve(d){let e=[];e.push(`## User Prompt #${d.prompt_number}`),e.push(`*Source: claude-mem://user-prompt/${d.id}*`),e.push(""),e.push(d.prompt_text),e.push(""),e.push("---");let t=new Date(d.created_at_epoch).toLocaleString();return e.push(`Date: ${t}`),e.join(`
`)}var Oe=a.object({project:a.string().optional().describe("Filter by project name"),type:a.union([a.enum(["decision","bugfix","feature","refactor","discovery","change"]),a.array(a.enum(["decision","bugfix","feature","refactor","discovery","change"]))]).optional().describe("Filter by observation type"),concepts:a.union([a.string(),a.array(a.string())]).optional().describe("Filter by concept tags"),files:a.union([a.string(),a.array(a.string())]).optional().describe("Filter by file paths (partial match)"),dateRange:a.object({start:a.union([a.string(),a.number()]).optional().describe("Start date (ISO string or epoch)"),end:a.union([a.string(),a.number()]).optional().describe("End date (ISO string or epoch)")}).optional().describe("Filter by date range"),limit:a.number().min(1).max(100).default(20).describe("Maximum number of results"),offset:a.number().min(0).default(0).describe("Number of results to skip"),orderBy:a.enum(["relevance","date_desc","date_asc"]).default("date_desc").describe("Sort order")}),oe=[{name:"search_observations",description:'Search observations using full-text search across titles, narratives, facts, and concepts. IMPORTANT: Always use index format first (default) to get an overview with minimal token usage, then use format: "full" only for specific items of interest.',inputSchema:a.object({query:a.string().describe("Search query for FTS5 full-text search"),format:a.enum(["index","full"]).default("index").describe('Output format: "index" for titles/dates only (default, RECOMMENDED for initial search), "full" for complete details (use only after reviewing index results)'),...Oe.shape}),handler:async d=>{try{let{query:e,format:t="index",...n}=d,s=[];if(F)try{console.error("[search-server] Using hybrid semantic search (Chroma + SQLite)");let o=await M(e,100);if(console.error(`[search-server] Chroma returned ${o.ids.length} semantic matches`),o.ids.length>0){let i=Date.now()-7776e6,u=o.ids.filter((c,p)=>{let l=o.metadatas[p];return l&&l.created_at_epoch>i});if(console.error(`[search-server] ${u.length} results within 90-day window`),u.length>0){let c=n.limit||20;s=v.getObservationsByIds(u,{orderBy:"date_desc",limit:c}),console.error(`[search-server] Hydrated ${s.length} observations from SQLite`)}}}catch(o){console.error("[search-server] Chroma query failed, falling back to FTS5:",o.message)}if(s.length===0&&(console.error("[search-server] Using FTS5 keyword search"),s=$.searchObservations(e,n)),s.length===0)return{content:[{type:"text",text:`No observations found matching "${e}"`}]};let r;if(t==="index"){let o=`Found ${s.length} observation(s) matching "${e}":

`,i=s.map((u,c)=>P(u,c));r=o+i.join(`

`)+j()}else r=s.map(i=>q(i)).join(`

---

`);return{content:[{type:"text",text:r}]}}catch(e){return{content:[{type:"text",text:`Search failed: ${e.message}`}],isError:!0}}}},{name:"search_sessions",description:'Search session summaries using full-text search across requests, completions, learnings, and notes. IMPORTANT: Always use index format first (default) to get an overview with minimal token usage, then use format: "full" only for specific items of interest.',inputSchema:a.object({query:a.string().describe("Search query for FTS5 full-text search"),format:a.enum(["index","full"]).default("index").describe('Output format: "index" for titles/dates only (default, RECOMMENDED for initial search), "full" for complete details (use only after reviewing index results)'),project:a.string().optional().describe("Filter by project name"),dateRange:a.object({start:a.union([a.string(),a.number()]).optional(),end:a.union([a.string(),a.number()]).optional()}).optional().describe("Filter by date range"),limit:a.number().min(1).max(100).default(20).describe("Maximum number of results"),offset:a.number().min(0).default(0).describe("Number of results to skip"),orderBy:a.enum(["relevance","date_desc","date_asc"]).default("date_desc").describe("Sort order")}),handler:async d=>{try{let{query:e,format:t="index",...n}=d,s=[];if(F)try{console.error("[search-server] Using hybrid semantic search for sessions");let o=await M(e,100,{doc_type:"session_summary"});if(console.error(`[search-server] Chroma returned ${o.ids.length} semantic matches`),o.ids.length>0){let i=Date.now()-7776e6,u=o.ids.filter((c,p)=>{let l=o.metadatas[p];return l&&l.created_at_epoch>i});if(console.error(`[search-server] ${u.length} results within 90-day window`),u.length>0){let c=n.limit||20;s=v.getSessionSummariesByIds(u,{orderBy:"date_desc",limit:c}),console.error(`[search-server] Hydrated ${s.length} sessions from SQLite`)}}}catch(o){console.error("[search-server] Chroma query failed, falling back to FTS5:",o.message)}if(s.length===0&&(console.error("[search-server] Using FTS5 keyword search"),s=$.searchSessions(e,n)),s.length===0)return{content:[{type:"text",text:`No sessions found matching "${e}"`}]};let r;if(t==="index"){let o=`Found ${s.length} session(s) matching "${e}":

`,i=s.map((u,c)=>re(u,c));r=o+i.join(`

`)+j()}else r=s.map(i=>ne(i)).join(`

---

`);return{content:[{type:"text",text:r}]}}catch(e){return{content:[{type:"text",text:`Search failed: ${e.message}`}],isError:!0}}}},{name:"find_by_concept",description:'Find observations tagged with a specific concept. Available concepts: "discovery", "problem-solution", "what-changed", "how-it-works", "pattern", "gotcha", "change". IMPORTANT: Always use index format first (default) to get an overview with minimal token usage, then use format: "full" only for specific items of interest.',inputSchema:a.object({concept:a.string().describe("Concept tag to search for. Available: discovery, problem-solution, what-changed, how-it-works, pattern, gotcha, change"),format:a.enum(["index","full"]).default("index").describe('Output format: "index" for titles/dates only (default, RECOMMENDED for initial search), "full" for complete details (use only after reviewing index results)'),project:a.string().optional().describe("Filter by project name"),dateRange:a.object({start:a.union([a.string(),a.number()]).optional(),end:a.union([a.string(),a.number()]).optional()}).optional().describe("Filter by date range"),limit:a.number().min(1).max(100).default(20).describe("Maximum results. IMPORTANT: Start with 3-5 to avoid exceeding MCP token limits, even in index mode."),offset:a.number().min(0).default(0).describe("Number of results to skip"),orderBy:a.enum(["relevance","date_desc","date_asc"]).default("date_desc").describe("Sort order")}),handler:async d=>{try{let{concept:e,format:t="index",...n}=d,s=[];if(F)try{console.error("[search-server] Using metadata-first + semantic ranking for concept search");let o=$.findByConcept(e,n);if(console.error(`[search-server] Found ${o.length} observations with concept "${e}"`),o.length>0){let i=o.map(p=>p.id),u=await M(e,Math.min(i.length,100)),c=[];for(let p of u.ids)i.includes(p)&&!c.includes(p)&&c.push(p);console.error(`[search-server] Chroma ranked ${c.length} results by semantic relevance`),c.length>0&&(s=v.getObservationsByIds(c,{limit:n.limit||20}),s.sort((p,l)=>c.indexOf(p.id)-c.indexOf(l.id)))}}catch(o){console.error("[search-server] Chroma ranking failed, using SQLite order:",o.message)}if(s.length===0&&(console.error("[search-server] Using SQLite-only concept search"),s=$.findByConcept(e,n)),s.length===0)return{content:[{type:"text",text:`No observations found with concept "${e}"`}]};let r;if(t==="index"){let o=`Found ${s.length} observation(s) with concept "${e}":

`,i=s.map((u,c)=>P(u,c));r=o+i.join(`

`)+j()}else r=s.map(i=>q(i)).join(`

---

`);return{content:[{type:"text",text:r}]}}catch(e){return{content:[{type:"text",text:`Search failed: ${e.message}`}],isError:!0}}}},{name:"find_by_file",description:'Find observations and sessions that reference a specific file path. IMPORTANT: Always use index format first (default) to get an overview with minimal token usage, then use format: "full" only for specific items of interest.',inputSchema:a.object({filePath:a.string().describe("File path to search for (supports partial matching)"),format:a.enum(["index","full"]).default("index").describe('Output format: "index" for titles/dates only (default, RECOMMENDED for initial search), "full" for complete details (use only after reviewing index results)'),project:a.string().optional().describe("Filter by project name"),dateRange:a.object({start:a.union([a.string(),a.number()]).optional(),end:a.union([a.string(),a.number()]).optional()}).optional().describe("Filter by date range"),limit:a.number().min(1).max(100).default(20).describe("Maximum results. IMPORTANT: Start with 3-5 to avoid exceeding MCP token limits, even in index mode."),offset:a.number().min(0).default(0).describe("Number of results to skip"),orderBy:a.enum(["relevance","date_desc","date_asc"]).default("date_desc").describe("Sort order")}),handler:async d=>{try{let{filePath:e,format:t="index",...n}=d,s=[],r=[];if(F)try{console.error("[search-server] Using metadata-first + semantic ranking for file search");let u=$.findByFile(e,n);if(console.error(`[search-server] Found ${u.observations.length} observations, ${u.sessions.length} sessions for file "${e}"`),r=u.sessions,u.observations.length>0){let c=u.observations.map(m=>m.id),p=await M(e,Math.min(c.length,100)),l=[];for(let m of p.ids)c.includes(m)&&!l.includes(m)&&l.push(m);console.error(`[search-server] Chroma ranked ${l.length} observations by semantic relevance`),l.length>0&&(s=v.getObservationsByIds(l,{limit:n.limit||20}),s.sort((m,E)=>l.indexOf(m.id)-l.indexOf(E.id)))}}catch(u){console.error("[search-server] Chroma ranking failed, using SQLite order:",u.message)}if(s.length===0&&r.length===0){console.error("[search-server] Using SQLite-only file search");let u=$.findByFile(e,n);s=u.observations,r=u.sessions}let o=s.length+r.length;if(o===0)return{content:[{type:"text",text:`No results found for file "${e}"`}]};let i;if(t==="index"){let u=`Found ${o} result(s) for file "${e}":

`,c=[];s.forEach((p,l)=>{c.push(P(p,l))}),r.forEach((p,l)=>{c.push(re(p,l+s.length))}),i=u+c.join(`

`)+j()}else{let u=[];s.forEach(c=>{u.push(q(c))}),r.forEach(c=>{u.push(ne(c))}),i=u.join(`

---

`)}return{content:[{type:"text",text:i}]}}catch(e){return{content:[{type:"text",text:`Search failed: ${e.message}`}],isError:!0}}}},{name:"find_by_type",description:'Find observations of a specific type (decision, bugfix, feature, refactor, discovery, change). IMPORTANT: Always use index format first (default) to get an overview with minimal token usage, then use format: "full" only for specific items of interest.',inputSchema:a.object({type:a.union([a.enum(["decision","bugfix","feature","refactor","discovery","change"]),a.array(a.enum(["decision","bugfix","feature","refactor","discovery","change"]))]).describe("Observation type(s) to filter by"),format:a.enum(["index","full"]).default("index").describe('Output format: "index" for titles/dates only (default, RECOMMENDED for initial search), "full" for complete details (use only after reviewing index results)'),project:a.string().optional().describe("Filter by project name"),dateRange:a.object({start:a.union([a.string(),a.number()]).optional(),end:a.union([a.string(),a.number()]).optional()}).optional().describe("Filter by date range"),limit:a.number().min(1).max(100).default(20).describe("Maximum results. IMPORTANT: Start with 3-5 to avoid exceeding MCP token limits, even in index mode."),offset:a.number().min(0).default(0).describe("Number of results to skip"),orderBy:a.enum(["relevance","date_desc","date_asc"]).default("date_desc").describe("Sort order")}),handler:async d=>{try{let{type:e,format:t="index",...n}=d,s=Array.isArray(e)?e.join(", "):e,r=[];if(F)try{console.error("[search-server] Using metadata-first + semantic ranking for type search");let i=$.findByType(e,n);if(console.error(`[search-server] Found ${i.length} observations with type "${s}"`),i.length>0){let u=i.map(l=>l.id),c=await M(s,Math.min(u.length,100)),p=[];for(let l of c.ids)u.includes(l)&&!p.includes(l)&&p.push(l);console.error(`[search-server] Chroma ranked ${p.length} results by semantic relevance`),p.length>0&&(r=v.getObservationsByIds(p,{limit:n.limit||20}),r.sort((l,m)=>p.indexOf(l.id)-p.indexOf(m.id)))}}catch(i){console.error("[search-server] Chroma ranking failed, using SQLite order:",i.message)}if(r.length===0&&(console.error("[search-server] Using SQLite-only type search"),r=$.findByType(e,n)),r.length===0)return{content:[{type:"text",text:`No observations found with type "${s}"`}]};let o;if(t==="index"){let i=`Found ${r.length} observation(s) with type "${s}":

`,u=r.map((c,p)=>P(c,p));o=i+u.join(`

`)+j()}else o=r.map(u=>q(u)).join(`

---

`);return{content:[{type:"text",text:o}]}}catch(e){return{content:[{type:"text",text:`Search failed: ${e.message}`}],isError:!0}}}},{name:"get_recent_context",description:"Get recent session context including summaries and observations for a project",inputSchema:a.object({project:a.string().optional().describe("Project name (defaults to current working directory basename)"),limit:a.number().min(1).max(10).default(3).describe("Number of recent sessions to retrieve")}),handler:async d=>{try{let e=d.project||ye(process.cwd()),t=d.limit||3,n=v.getRecentSessionsWithStatus(e,t);if(n.length===0)return{content:[{type:"text",text:`# Recent Session Context

No previous sessions found for project "${e}".`}]};let s=[];s.push("# Recent Session Context"),s.push(""),s.push(`Showing last ${n.length} session(s) for **${e}**:`),s.push("");for(let r of n)if(r.sdk_session_id){if(s.push("---"),s.push(""),r.has_summary){let o=v.getSummaryForSession(r.sdk_session_id);if(o){let i=o.prompt_number?` (Prompt #${o.prompt_number})`:"";if(s.push(`**Summary${i}**`),s.push(""),o.request&&s.push(`**Request:** ${o.request}`),o.completed&&s.push(`**Completed:** ${o.completed}`),o.learned&&s.push(`**Learned:** ${o.learned}`),o.next_steps&&s.push(`**Next Steps:** ${o.next_steps}`),o.files_read)try{let c=JSON.parse(o.files_read);Array.isArray(c)&&c.length>0&&s.push(`**Files Read:** ${c.join(", ")}`)}catch{o.files_read.trim()&&s.push(`**Files Read:** ${o.files_read}`)}if(o.files_edited)try{let c=JSON.parse(o.files_edited);Array.isArray(c)&&c.length>0&&s.push(`**Files Edited:** ${c.join(", ")}`)}catch{o.files_edited.trim()&&s.push(`**Files Edited:** ${o.files_edited}`)}let u=new Date(o.created_at).toLocaleString();s.push(`**Date:** ${u}`)}}else if(r.status==="active"){s.push("**In Progress**"),s.push(""),r.user_prompt&&s.push(`**Request:** ${r.user_prompt}`);let o=v.getObservationsForSession(r.sdk_session_id);if(o.length>0){s.push(""),s.push(`**Observations (${o.length}):**`);for(let u of o)s.push(`- ${u.title}`)}else s.push(""),s.push("*No observations yet*");s.push(""),s.push("**Status:** Active - summary pending");let i=new Date(r.started_at).toLocaleString();s.push(`**Date:** ${i}`)}else{s.push(`**${r.status.charAt(0).toUpperCase()+r.status.slice(1)}**`),s.push(""),r.user_prompt&&s.push(`**Request:** ${r.user_prompt}`),s.push(""),s.push(`**Status:** ${r.status} - no summary available`);let o=new Date(r.started_at).toLocaleString();s.push(`**Date:** ${o}`)}s.push("")}return{content:[{type:"text",text:s.join(`
`)}]}}catch(e){return{content:[{type:"text",text:`Failed to get recent context: ${e.message}`}],isError:!0}}}},{name:"search_user_prompts",description:'Search raw user prompts with full-text search. Use this to find what the user actually said/requested across all sessions. IMPORTANT: Always use index format first (default) to get an overview with minimal token usage, then use format: "full" only for specific items of interest.',inputSchema:a.object({query:a.string().describe("Search query for FTS5 full-text search"),format:a.enum(["index","full"]).default("index").describe('Output format: "index" for truncated prompts/dates (default, RECOMMENDED for initial search), "full" for complete prompt text (use only after reviewing index results)'),project:a.string().optional().describe("Filter by project name"),dateRange:a.object({start:a.union([a.string(),a.number()]).optional(),end:a.union([a.string(),a.number()]).optional()}).optional().describe("Filter by date range"),limit:a.number().min(1).max(100).default(20).describe("Maximum number of results"),offset:a.number().min(0).default(0).describe("Number of results to skip"),orderBy:a.enum(["relevance","date_desc","date_asc"]).default("date_desc").describe("Sort order")}),handler:async d=>{try{let{query:e,format:t="index",...n}=d,s=[];if(F)try{console.error("[search-server] Using hybrid semantic search for user prompts");let o=await M(e,100,{doc_type:"user_prompt"});if(console.error(`[search-server] Chroma returned ${o.ids.length} semantic matches`),o.ids.length>0){let i=Date.now()-7776e6,u=o.ids.filter((c,p)=>{let l=o.metadatas[p];return l&&l.created_at_epoch>i});if(console.error(`[search-server] ${u.length} results within 90-day window`),u.length>0){let c=n.limit||20;s=v.getUserPromptsByIds(u,{orderBy:"date_desc",limit:c}),console.error(`[search-server] Hydrated ${s.length} user prompts from SQLite`)}}}catch(o){console.error("[search-server] Chroma query failed, falling back to FTS5:",o.message)}if(s.length===0&&(console.error("[search-server] Using FTS5 keyword search"),s=$.searchUserPrompts(e,n)),s.length===0)return{content:[{type:"text",text:`No user prompts found matching "${e}"`}]};let r;if(t==="index"){let o=`Found ${s.length} user prompt(s) matching "${e}":

`,i=s.map((u,c)=>Re(u,c));r=o+i.join(`

`)+j()}else r=s.map(i=>ve(i)).join(`

---

`);return{content:[{type:"text",text:r}]}}catch(e){return{content:[{type:"text",text:`Search failed: ${e.message}`}],isError:!0}}}},{name:"get_context_timeline",description:'Get a unified timeline of context (observations, sessions, and prompts) around a specific point in time. All record types are interleaved chronologically. Useful for understanding "what was happening when X occurred". Returns depth_before records before anchor + anchor + depth_after records after (total: depth_before + 1 + depth_after mixed records).',inputSchema:a.object({anchor:a.union([a.number().describe("Observation ID to center timeline around"),a.string().describe("Session ID (format: S123) or ISO timestamp to center timeline around")]).describe('Anchor point: observation ID, session ID (e.g., "S123"), or ISO timestamp'),depth_before:a.number().min(0).max(50).default(10).describe("Number of records to retrieve before anchor, not including anchor (default: 10)"),depth_after:a.number().min(0).max(50).default(10).describe("Number of records to retrieve after anchor, not including anchor (default: 10)"),project:a.string().optional().describe("Filter by project name")}),handler:async d=>{try{let E=function(g){return new Date(g).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})},h=function(g){return new Date(g).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})},b=function(g){return new Date(g).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})},_=function(g){return g?Math.ceil(g.length/4):0};var e=E,t=h,n=b,s=_;let{anchor:r,depth_before:o=10,depth_after:i=10,project:u}=d,c,p=r,l;if(typeof r=="number"){let g=v.getObservationById(r);if(!g)return{content:[{type:"text",text:`Observation #${r} not found`}],isError:!0};c=g.created_at_epoch,l=v.getTimelineAroundObservation(r,c,o,i,u)}else if(typeof r=="string")if(r.startsWith("S")||r.startsWith("#S")){let g=r.replace(/^#?S/,""),I=parseInt(g,10),y=v.getSessionSummariesByIds([I]);if(y.length===0)return{content:[{type:"text",text:`Session #${I} not found`}],isError:!0};c=y[0].created_at_epoch,p=`S${I}`,l=v.getTimelineAroundTimestamp(c,o,i,u)}else{let g=new Date(r);if(isNaN(g.getTime()))return{content:[{type:"text",text:`Invalid timestamp: ${r}`}],isError:!0};c=g.getTime(),l=v.getTimelineAroundTimestamp(c,o,i,u)}else return{content:[{type:"text",text:'Invalid anchor: must be observation ID (number), session ID (e.g., "S123"), or ISO timestamp'}],isError:!0};let m=[...l.observations.map(g=>({type:"observation",data:g,epoch:g.created_at_epoch})),...l.sessions.map(g=>({type:"session",data:g,epoch:g.created_at_epoch})),...l.prompts.map(g=>({type:"prompt",data:g,epoch:g.created_at_epoch}))];if(m.sort((g,I)=>g.epoch-I.epoch),m.length===0)return{content:[{type:"text",text:`No context found around ${new Date(c).toLocaleString()} (${o} records before, ${i} records after)`}]};let f=[];f.push(`# Timeline around anchor: ${p}`),f.push(`**Window:** ${o} records before \u2192 ${i} records after | **Items:** ${m.length} (${l.observations.length} obs, ${l.sessions.length} sessions, ${l.prompts.length} prompts)`),f.push(""),f.push("**Legend:** \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u{1F9E0} decision"),f.push("");let w=new Map;for(let g of m){let I=E(g.epoch);w.has(I)||w.set(I,[]),w.get(I).push(g)}let T=Array.from(w.entries()).sort((g,I)=>{let y=new Date(g[0]).getTime(),N=new Date(I[0]).getTime();return y-N});for(let[g,I]of T){f.push(`### ${g}`),f.push("");let y=null,N="",L=!1;for(let O of I){let U=typeof p=="number"&&O.type==="observation"&&O.data.id===p||typeof p=="string"&&p.startsWith("S")&&O.type==="session"&&`S${O.data.id}`===p;if(O.type==="session"){L&&(f.push(""),L=!1,y=null,N="");let S=O.data,k=S.request||"Session summary",R=`claude-mem://session-summary/${S.id}`,A=U?" \u2190 **ANCHOR**":"";f.push(`**\u{1F3AF} #S${S.id}** ${k} (${b(O.epoch)}) [\u2192](${R})${A}`),f.push("")}else if(O.type==="prompt"){L&&(f.push(""),L=!1,y=null,N="");let S=O.data,k=S.prompt.length>100?S.prompt.substring(0,100)+"...":S.prompt;f.push(`**\u{1F4AC} User Prompt #${S.prompt_number}** (${b(O.epoch)})`),f.push(`> ${k}`),f.push("")}else if(O.type==="observation"){let S=O.data,k="General";k!==y&&(L&&f.push(""),f.push(`**${k}**`),f.push("| ID | Time | T | Title | Tokens |"),f.push("|----|------|---|-------|--------|"),y=k,L=!0,N="");let R="\u2022";switch(S.type){case"bugfix":R="\u{1F534}";break;case"feature":R="\u{1F7E3}";break;case"refactor":R="\u{1F504}";break;case"change":R="\u2705";break;case"discovery":R="\u{1F535}";break;case"decision":R="\u{1F9E0}";break}let A=h(O.epoch),C=S.title||"Untitled",B=_(S.narrative),Y=A!==N?A:"\u2033";N=A;let Z=U?" \u2190 **ANCHOR**":"";f.push(`| #${S.id} | ${Y} | ${R} | ${C}${Z} | ~${B} |`)}}L&&f.push("")}return{content:[{type:"text",text:f.join(`
`)}]}}catch(r){return{content:[{type:"text",text:`Timeline query failed: ${r.message}`}],isError:!0}}}},{name:"get_timeline_by_query",description:'Search for observations using natural language and get timeline context around the best match. Two modes: "auto" (default) automatically uses top result as timeline anchor; "interactive" returns top matches for you to choose from. This combines search + timeline into a single operation for faster context discovery.',inputSchema:a.object({query:a.string().describe("Natural language search query to find relevant observations"),mode:a.enum(["auto","interactive"]).default("auto").describe("auto: Automatically use top search result as timeline anchor. interactive: Show top N search results for manual anchor selection."),depth_before:a.number().min(0).max(50).default(10).describe("Number of timeline records before anchor (default: 10)"),depth_after:a.number().min(0).max(50).default(10).describe("Number of timeline records after anchor (default: 10)"),limit:a.number().min(1).max(20).default(5).describe("For interactive mode: number of top search results to display (default: 5)"),project:a.string().optional().describe("Filter by project name")}),handler:async d=>{try{let{query:r,mode:o="auto",depth_before:i=10,depth_after:u=10,limit:c=5,project:p}=d,l=[];if(F)try{console.error("[search-server] Using hybrid semantic search for timeline query");let m=await M(r,100);if(console.error(`[search-server] Chroma returned ${m.ids.length} semantic matches`),m.ids.length>0){let E=Date.now()-7776e6,h=m.ids.filter((b,_)=>{let f=m.metadatas[_];return f&&f.created_at_epoch>E});console.error(`[search-server] ${h.length} results within 90-day window`),h.length>0&&(l=v.getObservationsByIds(h,{orderBy:"date_desc",limit:o==="auto"?1:c}),console.error(`[search-server] Hydrated ${l.length} observations from SQLite`))}}catch(m){console.error("[search-server] Chroma query failed, falling back to FTS5:",m.message)}if(l.length===0&&(console.error("[search-server] Using FTS5 keyword search"),l=$.searchObservations(r,{orderBy:"relevance",limit:o==="auto"?1:c,project:p})),l.length===0)return{content:[{type:"text",text:`No observations found matching "${r}". Try a different search query.`}]};if(o==="interactive"){let m=[];m.push("# Timeline Anchor Search Results"),m.push(""),m.push(`Found ${l.length} observation(s) matching "${r}"`),m.push(""),m.push("To get timeline context around any of these observations, use the `get_context_timeline` tool with the observation ID as the anchor."),m.push(""),m.push(`**Top ${l.length} matches:**`),m.push("");for(let E=0;E<l.length;E++){let h=l[E],b=h.title||`Observation #${h.id}`,_=new Date(h.created_at_epoch).toLocaleString(),f=h.type?`[${h.type}]`:"";m.push(`${E+1}. **${f} ${b}**`),m.push(`   - ID: ${h.id}`),m.push(`   - Date: ${_}`),h.subtitle&&m.push(`   - ${h.subtitle}`),m.push(`   - Source: claude-mem://observation/${h.id}`),m.push("")}return{content:[{type:"text",text:m.join(`
`)}]}}else{let b=function(y){return new Date(y).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})},_=function(y){return new Date(y).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})},f=function(y){return new Date(y).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})},w=function(y){return y?Math.ceil(y.length/4):0};var e=b,t=_,n=f,s=w;let m=l[0];console.error(`[search-server] Auto mode: Using observation #${m.id} as timeline anchor`);let E=v.getTimelineAroundObservation(m.id,m.created_at_epoch,i,u,p),h=[...E.observations.map(y=>({type:"observation",data:y,epoch:y.created_at_epoch})),...E.sessions.map(y=>({type:"session",data:y,epoch:y.created_at_epoch})),...E.prompts.map(y=>({type:"prompt",data:y,epoch:y.created_at_epoch}))];if(h.sort((y,N)=>y.epoch-N.epoch),h.length===0)return{content:[{type:"text",text:`Found observation #${m.id} matching "${r}", but no timeline context available (${i} records before, ${u} records after).`}]};let T=[];T.push(`# Timeline for query: "${r}"`),T.push(`**Anchor:** Observation #${m.id} - ${m.title||"Untitled"}`),T.push(`**Window:** ${i} records before \u2192 ${u} records after | **Items:** ${h.length} (${E.observations.length} obs, ${E.sessions.length} sessions, ${E.prompts.length} prompts)`),T.push(""),T.push("**Legend:** \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u{1F9E0} decision"),T.push("");let g=new Map;for(let y of h){let N=b(y.epoch);g.has(N)||g.set(N,[]),g.get(N).push(y)}let I=Array.from(g.entries()).sort((y,N)=>{let L=new Date(y[0]).getTime(),O=new Date(N[0]).getTime();return L-O});for(let[y,N]of I){T.push(`### ${y}`),T.push("");let L=null,O="",U=!1;for(let S of N){let k=S.type==="observation"&&S.data.id===m.id;if(S.type==="session"){U&&(T.push(""),U=!1,L=null,O="");let R=S.data,A=R.request||"Session summary",C=`claude-mem://session-summary/${R.id}`;T.push(`**\u{1F3AF} #S${R.id}** ${A} (${f(S.epoch)}) [\u2192](${C})`),T.push("")}else if(S.type==="prompt"){U&&(T.push(""),U=!1,L=null,O="");let R=S.data,A=R.prompt.length>100?R.prompt.substring(0,100)+"...":R.prompt;T.push(`**\u{1F4AC} User Prompt #${R.prompt_number}** (${f(S.epoch)})`),T.push(`> ${A}`),T.push("")}else if(S.type==="observation"){let R=S.data,A="General";A!==L&&(U&&T.push(""),T.push(`**${A}**`),T.push("| ID | Time | T | Title | Tokens |"),T.push("|----|------|---|-------|--------|"),L=A,U=!0,O="");let C="\u2022";switch(R.type){case"bugfix":C="\u{1F534}";break;case"feature":C="\u{1F7E3}";break;case"refactor":C="\u{1F504}";break;case"change":C="\u2705";break;case"discovery":C="\u{1F535}";break;case"decision":C="\u{1F9E0}";break}let B=_(S.epoch),z=R.title||"Untitled",Y=w(R.narrative),ie=B!==O?B:"\u2033";O=B;let ae=k?" \u2190 **ANCHOR**":"";T.push(`| #${R.id} | ${ie} | ${C} | ${z}${ae} | ~${Y} |`)}}U&&T.push("")}return{content:[{type:"text",text:T.join(`
`)}]}}}catch(r){return{content:[{type:"text",text:`Timeline query failed: ${r.message}`}],isError:!0}}}},{name:"query_by_dimension",description:"Query observations using SixSpec dimensional filters (WHO, WHAT, WHEN, WHERE, WHY, HOW). Enables searching by purpose (WHY), method (HOW), actors (WHO), components (WHERE), and more.",inputSchema:a.object({project:a.string().describe("Project name to search within"),who:a.string().optional().describe("Filter by WHO dimension (actors, stakeholders)"),what:a.string().optional().describe("Filter by WHAT dimension (actions, objects)"),when:a.string().optional().describe("Filter by WHEN dimension (temporal context)"),where:a.string().optional().describe("Filter by WHERE dimension (spatial context, components)"),why:a.string().optional().describe("Filter by WHY dimension (purpose, motivation)"),how:a.string().optional().describe("Filter by HOW dimension (methods, processes)"),type:a.enum(["decision","bugfix","feature","refactor","discovery","change"]).optional().describe("Filter by observation type"),limit:a.number().optional().default(50).describe("Maximum number of results (default: 50)")}),handler:async d=>{try{let{project:e,limit:t=50,...n}=d,s=v.queryObservationsByDimension(e,n,t);if(s.length===0)return{content:[{type:"text",text:"No observations found matching dimensional criteria"}]};let r=s.map((i,u)=>{let c=[];return c.push(`${u+1}. ${i.title||`Observation #${i.id}`}`),i.dim_why&&c.push(`   WHY: ${i.dim_why}`),i.dim_how&&c.push(`   HOW: ${i.dim_how}`),i.dim_what&&c.push(`   WHAT: ${i.dim_what}`),i.dim_where&&c.push(`   WHERE: ${i.dim_where}`),i.dim_who&&c.push(`   WHO: ${i.dim_who}`),i.dim_when&&c.push(`   WHEN: ${i.dim_when}`),c.push(`   Date: ${new Date(i.created_at_epoch).toLocaleString()}`),c.push(`   Source: claude-mem://observation/${i.id}`),c.join(`
`)});return{content:[{type:"text",text:`Found ${s.length} observation(s) matching dimensional criteria:

`+r.join(`

`)}]}}catch(e){return{content:[{type:"text",text:`Query failed: ${e.message}`}],isError:!0}}}},{name:"trace_purpose_chain",description:"Trace the WHY<>WHAT propagation chain from an observation to its root. Shows how parent's WHAT becomes child's WHY (SixSpec principle).",inputSchema:a.object({observation_id:a.number().describe("Observation ID to trace purpose chain from")}),handler:async d=>{try{let{observation_id:e}=d,t=v.tracePurposeChain(e);return t.length===0?{content:[{type:"text",text:`No purpose chain found for observation #${e}`}]}:{content:[{type:"text",text:`Purpose Chain (Root \u2192 Leaf):

`+t.map((o,i)=>{let u=[];return u.push(`${i+1}. Observation #${o.id}${o.dilts_level?` (Level ${o.dilts_level})`:""}`),o.dim_what&&u.push(`   WHAT: ${o.dim_what}`),o.dim_why&&u.push(`   WHY: ${o.dim_why}`),u.push(`   Date: ${new Date(o.created_at).toLocaleString()}`),u.join(`
`)}).join(`

`)+`

\u{1F4A1} WHY<>WHAT Propagation:
Each level's WHAT becomes the next level's WHY, maintaining purpose throughout execution.`}]}}catch(e){return{content:[{type:"text",text:`Trace failed: ${e.message}`}],isError:!0}}}},{name:"query_git_commits",description:"Query git commits by dimensional metadata (WHY, HOW, WHERE, etc.). Enables searching commit history by purpose and technical approach.",inputSchema:a.object({project:a.string().describe("Project name to search within"),who:a.string().optional().describe("Filter by WHO dimension"),what:a.string().optional().describe("Filter by WHAT dimension"),when:a.string().optional().describe("Filter by WHEN dimension"),where:a.string().optional().describe("Filter by WHERE dimension (files, components)"),why:a.string().optional().describe("Filter by WHY dimension (purpose)"),how:a.string().optional().describe("Filter by HOW dimension (technical approach)"),type:a.enum(["feat","fix","refactor","docs","test","chore"]).optional().describe("Filter by commit type"),limit:a.number().optional().default(50).describe("Maximum number of results (default: 50)")}),handler:async d=>{try{let{project:e,limit:t=50,...n}=d,s=v.queryGitCommitsByDimension(e,n,t);if(s.length===0)return{content:[{type:"text",text:"No git commits found matching dimensional criteria"}]};let r=s.map((i,u)=>{let c=[];return c.push(`${u+1}. [${i.commit_type}] ${i.subject}`),c.push(`   Commit: ${i.commit_hash.substring(0,8)}`),c.push(`   WHY: ${i.dim_why}`),c.push(`   HOW: ${i.dim_how}`),i.dim_where&&c.push(`   WHERE: ${i.dim_where}`),i.dim_who&&c.push(`   WHO: ${i.dim_who}`),c.push(`   Date: ${new Date(i.committed_at_epoch).toLocaleString()}`),c.join(`
`)});return{content:[{type:"text",text:`Found ${s.length} commit(s) matching dimensional criteria:

`+r.join(`

`)}]}}catch(e){return{content:[{type:"text",text:`Query failed: ${e.message}`}],isError:!0}}}},{name:"get_purpose_inventory",description:"Get all unique WHY (purpose) values for a project. Shows what purposes have been pursued and how frequently.",inputSchema:a.object({project:a.string().describe("Project name to get purpose inventory for")}),handler:async d=>{try{let{project:e}=d,t=v.getUniquePurposes(e);if(t.length===0)return{content:[{type:"text",text:`No purposes found for project "${e}"`}]};let n=t.map((r,o)=>`${o+1}. ${r.why} (${r.count} occurrence${r.count>1?"s":""})`);return{content:[{type:"text",text:`Purpose Inventory for "${e}":

`+n.join(`
`)}]}}catch(e){return{content:[{type:"text",text:`Query failed: ${e.message}`}],isError:!0}}}},{name:"get_validation_history",description:"Get validation history showing belief revision over time. Shows how confidence changed based on actual results (SixSpec validation over prediction principle).",inputSchema:a.object({project:a.string().describe("Project name to get validation history for"),limit:a.number().optional().default(100).describe("Maximum number of results (default: 100)")}),handler:async d=>{try{let{project:e,limit:t=100}=d,n=v.getValidationHistory(e,t);if(n.length===0)return{content:[{type:"text",text:`No validation history found for project "${e}"`}]};let s=n.map((i,u)=>{let c=[];return c.push(`${u+1}. [${i.type}] ${i.dim_what||"Unknown action"}`),i.dim_why&&c.push(`   WHY: ${i.dim_why}`),c.push(`   Validation Score: ${i.validation_score?.toFixed(2)||"N/A"}`),c.push(`   Confidence (WHAT): ${i.confidence_what.toFixed(2)}`),c.push(`   Confidence (WHY): ${i.confidence_why.toFixed(2)}`),c.push(`   Date: ${new Date(i.created_at).toLocaleString()}`),c.join(`
`)});return{content:[{type:"text",text:`Validation History for "${e}":

`+s.join(`

`)+`

\u{1F4A1} Belief Revision:
Validation scores are based on actual results, not predictions.
Confidence is updated based on validation outcomes.`}]}}catch(e){return{content:[{type:"text",text:`Query failed: ${e.message}`}],isError:!0}}}}],J=new he({name:"claude-mem-search",version:"1.0.0"},{capabilities:{tools:{}}});J.setRequestHandler(ge,async()=>({tools:oe.map(d=>({name:d.name,description:d.description,inputSchema:Te(d.inputSchema)}))}));J.setRequestHandler(be,async d=>{let e=oe.find(t=>t.name===d.params.name);if(!e)throw new Error(`Unknown tool: ${d.params.name}`);try{return await e.handler(d.params.arguments||{})}catch(t){return{content:[{type:"text",text:`Tool execution failed: ${t.message}`}],isError:!0}}});async function Ne(){let d=new _e;await J.connect(d),console.error("[search-server] Claude-mem search server started"),setTimeout(async()=>{try{console.error("[search-server] Initializing Chroma client...");let e=new fe({command:"uvx",args:["chroma-mcp","--client-type","persistent","--data-dir",te],stderr:"ignore"}),t=new Ee({name:"claude-mem-search-chroma-client",version:"1.0.0"},{capabilities:{}});await t.connect(e),F=t,console.error("[search-server] Chroma client connected successfully")}catch(e){console.error("[search-server] Failed to initialize Chroma client:",e.message),console.error("[search-server] Falling back to FTS5-only search"),F=null}},0)}Ne().catch(d=>{console.error("[search-server] Fatal error:",d),process.exit(1)});
