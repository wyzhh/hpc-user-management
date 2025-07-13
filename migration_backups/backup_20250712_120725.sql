--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255),
    full_name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ldap_dn character varying(255),
    CONSTRAINT admins_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::text[])))
);


ALTER TABLE public.admins OWNER TO "user";

--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admins_id_seq OWNER TO "user";

--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    request_id integer,
    action character varying(50) NOT NULL,
    performer_type character varying(20) NOT NULL,
    performer_id integer NOT NULL,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO "user";

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO "user";

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: pis; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.pis (
    id integer NOT NULL,
    ldap_dn character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    full_name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    department character varying(200),
    phone character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pis OWNER TO "user";

--
-- Name: pis_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.pis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pis_id_seq OWNER TO "user";

--
-- Name: pis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.pis_id_seq OWNED BY public.pis.id;


--
-- Name: requests; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.requests (
    id integer NOT NULL,
    pi_id integer,
    request_type character varying(20) NOT NULL,
    student_id integer,
    student_data jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    reason text,
    admin_id integer,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp without time zone,
    CONSTRAINT requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['create'::character varying, 'delete'::character varying])::text[]))),
    CONSTRAINT requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.requests OWNER TO "user";

--
-- Name: requests_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.requests_id_seq OWNER TO "user";

--
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.students (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    chinese_name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    pi_id integer,
    ldap_dn character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT students_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'deleted'::character varying])::text[])))
);


ALTER TABLE public.students OWNER TO "user";

--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.students_id_seq OWNER TO "user";

--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: pis id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.pis ALTER COLUMN id SET DEFAULT nextval('public.pis_id_seq'::regclass);


--
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.admins (id, username, password_hash, full_name, email, role, is_active, created_at, ldap_dn) FROM stdin;
1	admin	$2b$10$R/Xi9n7PwOc4lD/aTIL/BOTDUaiHaXXs.GYs8b/JWaOhH0AaDjhq.	系统管理员	admin@hpc.university.edu	super_admin	t	2025-07-12 11:37:28.803463	\N
3	pi001	\N	张教授	zhang@hpc.university.edu	admin	t	2025-07-12 11:48:36.717762	{}
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.audit_logs (id, request_id, action, performer_type, performer_id, details, created_at) FROM stdin;
1	\N	user_login	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T11:25:23.042Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 11:25:23.042481
2	\N	user_logout	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T11:33:35.130Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 11:33:35.131145
3	\N	user_login	pi	1	{"ip": "::ffff:10.3.244.110", "timestamp": "2025-07-12T11:34:46.015Z", "userAgent": "curl/7.61.1"}	2025-07-12 11:34:46.015909
4	\N	user_login	admin	1	{"ip": "::ffff:10.3.244.110", "timestamp": "2025-07-12T11:37:55.163Z", "userAgent": "curl/7.61.1"}	2025-07-12 11:37:55.163605
5	\N	user_login	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T11:38:45.626Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 11:38:45.626625
6	\N	user_logout	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T11:49:37.462Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 11:49:37.462453
7	\N	user_login	admin	3	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T11:49:50.639Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 11:49:50.639253
8	\N	user_logout	admin	3	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T12:52:55.808Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 12:52:55.808434
9	\N	user_login	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T12:53:05.580Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 12:53:05.580421
10	1	request_created	pi	1	{"request_type": "create", "student_email": "yuzhanwang@cau.edu.cn", "student_username": "wyuzhan", "student_chinese_name": "王宇占"}	2025-07-12 13:12:02.054107
11	\N	user_logout	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:12:10.612Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:12:10.612709
12	\N	user_login	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:12:17.908Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:12:17.908598
13	\N	user_login	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:22:23.835Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:22:23.836322
14	\N	user_logout	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:22:33.786Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:22:33.786251
15	\N	user_login	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:22:37.508Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:22:37.508627
16	1	approve_request_error	admin	1	{"request_id": 1, "error_stack": "Error: Admin LDAP bind timeout\\n    at Timeout._onTimeout (/root/hpc-user-management/backend/src/services/ldap.ts:26:16)\\n    at listOnTimeout (node:internal/timers:588:17)\\n    at processTimers (node:internal/timers:523:7)", "request_type": "create", "error_message": "Admin LDAP bind timeout"}	2025-07-12 13:23:06.252636
17	1	approve_request_error	admin	1	{"request_id": 1, "error_stack": "Error: Admin LDAP bind timeout\\n    at Timeout._onTimeout (/root/hpc-user-management/backend/src/services/ldap.ts:26:16)\\n    at listOnTimeout (node:internal/timers:588:17)\\n    at processTimers (node:internal/timers:523:7)", "request_type": "create", "error_message": "Admin LDAP bind timeout"}	2025-07-12 13:23:19.289046
18	1	approve_request_error	admin	1	{"request_id": 1, "error_stack": "Error: Admin LDAP bind timeout\\n    at Timeout._onTimeout (/root/hpc-user-management/backend/src/services/ldap.ts:26:16)\\n    at listOnTimeout (node:internal/timers:588:17)\\n    at processTimers (node:internal/timers:523:7)", "request_type": "create", "error_message": "Admin LDAP bind timeout"}	2025-07-12 13:23:48.702953
19	1	approve_request_error	admin	1	{"request_id": 1, "error_stack": "Error: Admin LDAP bind timeout\\n    at Timeout._onTimeout (/root/hpc-user-management/backend/src/services/ldap.ts:26:16)\\n    at listOnTimeout (node:internal/timers:588:17)\\n    at processTimers (node:internal/timers:523:7)", "request_type": "create", "error_message": "Admin LDAP bind timeout"}	2025-07-12 13:25:32.038625
20	1	ldap_account_created	system	0	{"ldap_dn": "uid=wyuzhan,ou=students,dc=hpc,dc=university,dc=edu", "admin_id": 1, "student_username": "wyuzhan"}	2025-07-12 13:34:21.126565
21	1	request_approved	admin	1	{"reason": "", "student_id": 1, "request_type": "create"}	2025-07-12 13:34:21.128242
22	\N	user_logout	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:34:40.475Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:34:40.475443
23	\N	user_login	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:34:58.650Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:34:58.651117
24	\N	user_logout	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:35:28.651Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:35:28.651115
25	\N	user_login	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:35:34.398Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:35:34.398685
26	\N	user_logout	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:38:46.379Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:38:46.379667
27	\N	user_login	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:38:54.367Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:38:54.367584
28	\N	user_logout	pi	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:39:20.215Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:39:20.215989
29	\N	user_login	admin	1	{"ip": "::ffff:10.2.48.129", "timestamp": "2025-07-12T13:39:25.537Z", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}	2025-07-12 13:39:25.537954
30	\N	deactivate_pi_user	admin	1	{"pi_id": 1, "is_active": false}	2025-07-12 13:53:41.960567
31	\N	sync_ldap_users	admin	1	{"new_pis": 0, "synced_pis": 0, "updated_pis": 0}	2025-07-12 13:53:50.448404
32	\N	sync_ldap_users	admin	1	{"new_pis": 0, "synced_pis": 0, "updated_pis": 0}	2025-07-12 13:55:17.835228
33	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:34:44.234Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 1, "updated": 0}}}	2025-07-12 14:34:44.234451
34	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 1, "updated": 0}}, "trigger_time": "2025-07-12T14:34:44.235Z"}	2025-07-12 14:34:44.235464
35	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:34:52.987Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:34:52.98736
36	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:34:52.988Z"}	2025-07-12 14:34:52.988431
37	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:35:02.505Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:35:02.506179
38	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:35:02.507Z"}	2025-07-12 14:35:02.507199
39	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:35:15.245Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:35:15.245834
40	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:35:15.246Z"}	2025-07-12 14:35:15.246911
41	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:38:27.873Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:38:27.874015
42	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:38:27.874Z"}	2025-07-12 14:38:27.87502
43	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:40:00.039Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:40:00.039596
44	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "last_sync_time": "2025-07-11T14:40:00.010Z", "scheduled_time": "2025-07-12T14:40:00.040Z"}	2025-07-12 14:40:00.040462
45	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:48:50.324Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:48:50.325275
46	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:48:50.326Z"}	2025-07-12 14:48:50.326322
47	\N	ldap_full_sync	system	1	{"sync_time": "2025-07-12T14:49:02.701Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:49:02.701158
48	\N	sync_ldap_users_full	admin	1	{"sync_type": "full_sync", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:49:02.701986
49	\N	ldap_full_sync	system	1	{"sync_time": "2025-07-12T14:49:09.576Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:49:09.577015
50	\N	sync_ldap_users_full	admin	1	{"sync_type": "full_sync", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:49:09.577855
51	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:50:00.045Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:50:00.045241
52	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "last_sync_time": "2025-07-11T14:50:00.018Z", "scheduled_time": "2025-07-12T14:50:00.045Z"}	2025-07-12 14:50:00.046057
53	\N	ldap_full_sync	system	1	{"sync_time": "2025-07-12T14:52:47.745Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:52:47.745673
54	\N	sync_ldap_users_full	admin	1	{"sync_type": "full_sync", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:52:47.746446
55	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:55:49.792Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:55:49.792386
56	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:55:49.793Z"}	2025-07-12 14:55:49.793455
57	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:56:05.846Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:56:05.84708
58	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:56:05.847Z"}	2025-07-12 14:56:05.848139
59	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:57:01.411Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:57:01.412099
60	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 0, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:57:01.413Z"}	2025-07-12 14:57:01.413173
61	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T14:57:12.400Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 14:57:12.401034
62	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T14:57:12.401Z"}	2025-07-12 14:57:12.402089
63	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T15:00:00.027Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 1}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 15:00:00.027535
64	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 1}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "last_sync_time": "2025-07-11T15:00:00.010Z", "scheduled_time": "2025-07-12T15:00:00.028Z"}	2025-07-12 15:00:00.028321
65	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T15:10:00.030Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 15:10:00.030872
66	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "last_sync_time": "2025-07-11T15:10:00.010Z", "scheduled_time": "2025-07-12T15:10:00.031Z"}	2025-07-12 15:10:00.031686
67	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T15:11:00.164Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 15:11:00.165292
68	\N	manual_full_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "trigger_time": "2025-07-12T15:11:00.166Z"}	2025-07-12 15:11:00.166363
69	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T15:20:00.031Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 1}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 1, "updated": 0}}}	2025-07-12 15:20:00.031433
70	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 1}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 1, "updated": 0}}, "last_sync_time": "2025-07-11T15:20:00.007Z", "scheduled_time": "2025-07-12T15:20:00.032Z"}	2025-07-12 15:20:00.032227
71	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T15:30:00.055Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 15:30:00.055701
72	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "last_sync_time": "2025-07-11T15:30:00.034Z", "scheduled_time": "2025-07-12T15:30:00.056Z"}	2025-07-12 15:30:00.056493
73	\N	ldap_full_sync	system	0	{"sync_time": "2025-07-12T15:40:00.054Z", "sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}}	2025-07-12 15:40:00.054258
74	\N	scheduled_incremental_sync	system	0	{"sync_result": {"pis": {"total": 2, "created": 0, "updated": 1, "deactivated": 0}, "errors": [], "students": {"total": 1, "created": 0, "deleted": 0, "updated": 0}}, "last_sync_time": "2025-07-11T15:40:00.034Z", "scheduled_time": "2025-07-12T15:40:00.054Z"}	2025-07-12 15:40:00.055024
\.


--
-- Data for Name: pis; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.pis (id, ldap_dn, username, full_name, email, department, phone, is_active, created_at, updated_at) FROM stdin;
28	uid=pi002,ou=pis,dc=hpc,dc=university,dc=edu	pi002	李教授	li@hpc.university.edu	数学科学学院	010-87654321	f	2025-07-12 14:59:18.356183	2025-07-12 14:59:18.356183
1	{}	pi001	张教授	zhang@hpc.university.edu	计算机科学与技术学院	010-12345678	t	2025-07-12 11:25:23.038529	2025-07-12 15:40:00.043057
\.


--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.requests (id, pi_id, request_type, student_id, student_data, status, reason, admin_id, requested_at, reviewed_at) FROM stdin;
1	1	create	\N	{"email": "yuzhanwang@cau.edu.cn", "phone": "15910310092", "reason": "测试！！！！！！asdasdasdasdasd", "username": "wyuzhan", "chinese_name": "王宇占"}	approved		1	2025-07-12 13:12:02.052479	2025-07-12 09:34:21.127
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.students (id, username, chinese_name, email, phone, pi_id, ldap_dn, status, created_at, updated_at) FROM stdin;
1	wyuzhan	王宇占	yuzhanwang@cau.edu.cn	15910310092	1	uid=wyuzhan,ou=students,dc=hpc,dc=university,dc=edu	deleted	2025-07-12 13:34:21.125276	2025-07-12 13:34:21.125276
\.


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.admins_id_seq', 3, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 74, true);


--
-- Name: pis_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.pis_id_seq', 40, true);


--
-- Name: requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.requests_id_seq', 1, true);


--
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.students_id_seq', 1, true);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: pis pis_ldap_dn_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.pis
    ADD CONSTRAINT pis_ldap_dn_key UNIQUE (ldap_dn);


--
-- Name: pis pis_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.pis
    ADD CONSTRAINT pis_pkey PRIMARY KEY (id);


--
-- Name: pis pis_username_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.pis
    ADD CONSTRAINT pis_username_key UNIQUE (username);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_username_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_username_key UNIQUE (username);


--
-- Name: requests requests_pi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pi_id_fkey FOREIGN KEY (pi_id) REFERENCES public.pis(id) ON DELETE CASCADE;


--
-- Name: requests requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: students students_pi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pi_id_fkey FOREIGN KEY (pi_id) REFERENCES public.pis(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

