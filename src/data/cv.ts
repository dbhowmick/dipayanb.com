// Career data behind /work — lifted from the CV and rewritten in the first person.
// This is structured (non-prose) content, so it lives as a typed module rather than a
// content collection (those back the markdown-bodied `posts`/`projects`).
// <!-- TODO: review copy -->

export const PDF_URL = "/cv/dipayan-bhowmick-cv.pdf";

export interface Role {
  company: string;
  title: string;
  start: string;
  end: string;
  location: string;
  summary: string;
  highlights: string[];
  skills: string[];
  note?: string; // e.g. a status caveat shown as a muted tag
}

export interface EarlierRole {
  company: string;
  title: string;
  start: string;
  end: string;
  detail?: string;
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface Stat {
  metric: string;
  label: string;
}

/** Lede under the page title — a first-person rewrite of the CV summary. */
export const intro =
  "I build AI and data products and take them from nothing to paying customers. I joined " +
  "Acceldata as employee #2 and grew its data-observability platform to $4M in ARR across more " +
  "than eight Fortune 500 accounts. Most recently I led engineering and ran the India site for " +
  "Altimate AI, building agentic AI teammates for data teams. Eighteen years in, I'm hands-on " +
  "with LLMs, RAG, and agent frameworks, with a long background in distributed data systems. " +
  "I've owned the architecture, run the team, and sat in on the sales calls, often all at once.";

export const stats: Stat[] = [
  { metric: "$0 → $4M ARR", label: "Acceldata, built from scratch" },
  { metric: "8+ Fortune 500", label: "Enterprise accounts won" },
  { metric: "18 years", label: "Across the stack" },
  { metric: "Apache committer", label: "Ambari" },
];

export const experience: Role[] = [
  {
    company: "Altimate AI",
    title: "Head of Engineering & Site Lead, India",
    start: "Feb 2025",
    end: "Jan 2026",
    location: "Bengaluru",
    summary:
      "Ran engineering at a seed-stage startup building agentic AI teammates for data teams, plugged into IDEs, Git, and Slack.",
    highlights: [
      "Shipped agentic AI teammates to more than five customers in production, working inside their IDEs, Git, and Slack.",
      "Designed and built the memory system the agents run on, so they keep context across sessions, tools, and data sources.",
      "Wrote the SQL parser and scanner for the DataPilot platform so the agents could read customer warehouses safely and get the answers right.",
      "Built the India site from scratch. Hired and ran a team of 20 across engineering, product, and operations, and handled vendors and site strategy myself.",
      "Set up an engineering process that fit a 20-person team: enough structure to ship reliably without slowing anyone down.",
      "Moved ingestion to ClickHouse, which dropped OpenSearch usage to 10% and steadied the pipelines. Cut AWS spend by 25% after auditing what we were actually paying for.",
    ],
    skills: ["Python", "FastAPI", "LangChain", "CrewAI", "ClickHouse", "OpenSearch", "AWS", "RAG", "MCPs"],
  },
  {
    company: "Cyware",
    title: "Director of Engineering, Intel Exchange",
    start: "Sep 2024",
    end: "Feb 2025",
    location: "Bengaluru",
    summary:
      "Ran engineering for the Intel Exchange threat-intelligence platform, a team of 25 across backend, frontend, and QA, working closely with PMs and GTM on a customer-driven roadmap.",
    highlights: [
      "Got the platform through FedRAMP certification, the gate to a large US government deal.",
      "Delivered the 2.x to 3.x upgrade path and unblocked customer migrations that had no clean route before.",
      "Built platform observability from nothing, which cut the time to diagnose production issues and brought escalations down.",
      "Kept existing customers on a steady release cadence, shipping features, stabilization, and architecture work while the compliance effort ran in parallel.",
    ],
    skills: ["Python", "FastAPI", "Django", "Cybersecurity", "Threat Intelligence", "Observability"],
  },
  {
    company: "AI Revenue Operations",
    title: "Founder",
    start: "Aug 2023",
    end: "Sep 2024",
    location: "Bengaluru",
    note: "Did not continue",
    summary: "My own startup, building AI to run revenue operations.",
    highlights: [
      "Built it to a working POC with a co-founder and one design partner.",
      "Pitched investors but didn't close a round.",
      "Wound it down when the early signal wasn't there. I'd make the same call again.",
    ],
    skills: ["AI", "Product", "Fundraising"],
  },
  {
    company: "Acceldata",
    title: "Director of Engineering · Principal Engineer → Senior EM → Director",
    start: "Aug 2019",
    end: "Aug 2023",
    location: "Bangalore",
    summary:
      "Employee #2. Built the Data Observability Cloud Platform (ADOC) from an empty repo to more than $4M in ARR.",
    highlights: [
      "Architected ADOC and owned the roadmap and the engineering behind it from day one.",
      "Worked alongside Sales, Marketing, and Customer Success to win and grow more than eight Fortune 500 accounts.",
      "Grew the team from two of us to 20 engineers across three teams, and hired 75+ people across the org.",
      "Built the cloud SaaS version of the product and scaled it past 20 customers.",
      "Took the release cycle from once a quarter to once every two weeks.",
      "Built the alerts and auto-actions engine that sends more than 50,000 emails and Slack messages a day.",
      "Ran Spark on Kubernetes before Spark supported K8s natively.",
      "For one customer, processed 450 million nested JSON records per batch and brought the job down from 20 days to 7 hours.",
    ],
    skills: [
      "Apache Spark", "Kotlin", "Scala", "Postgres", "MongoDB",
      "Snowflake", "Databricks", "Kafka", "Kubernetes", "Microservices",
    ],
  },
  {
    company: "Hortonworks",
    title: "Engineering Manager · Senior MTS → Staff Engineer → EM",
    start: "Jul 2015",
    end: "Mar 2019",
    location: "Bangalore",
    summary:
      "Started as an IC on Apache Ambari and moved into managing a team of 8 building Dataplane.",
    highlights: [
      "Scaled Apache Ambari to manage 4,000-node Hadoop clusters, and was made an Apache committer for the work.",
      "Led the Ambari Views framework and improved performance and the experience across the Hive and Files views.",
      "Built Dataplane, a tool for orchestrating software deployments across the Hadoop ecosystem, and shipped it to three customer datacenters.",
      "Led the work to turn Dataplane into a closed-source product inside an open-source company.",
    ],
    skills: ["Java", "Scala", "Kafka", "Docker", "Kubernetes", "Postgres", "Hadoop", "Apache Ambari"],
  },
];

export const earlier: EarlierRole[] = [
  {
    company: "Flipkart",
    title: "SDE III",
    start: "Dec 2014",
    end: "Jul 2015",
    detail: "Ran five order-management microservices that handled 500,000 orders a day at peak.",
  },
  {
    company: "[24]7.ai (iLabs)",
    title: "Team Lead",
    start: "Jun 2013",
    end: "Dec 2014",
    detail: "Built data-analysis tooling for the data-science team and a customer-facing reporting platform.",
  },
  {
    company: "Oracle",
    title: "Senior Member of Technical Staff",
    start: "Sep 2011",
    end: "Jun 2013",
  },
  {
    company: "GE Healthcare · Mobilium (Roamware) · IBM",
    title: "Various engineering roles",
    start: "Jul 2007",
    end: "Sep 2011",
  },
];

export const skills: SkillGroup[] = [
  {
    label: "AI & Agentic Systems",
    items: ["AI Agents", "LLMs", "RAG Pipelines", "Tools / MCPs", "Machine Learning"],
  },
  {
    label: "Data Infrastructure & Observability",
    items: ["Data Observability", "Data Pipelines", "Apache Spark", "ClickHouse", "Kafka", "Snowflake", "Databricks", "Hadoop Ecosystem"],
  },
  {
    label: "Cloud, DevOps & Architecture",
    items: ["AWS", "Azure", "Kubernetes", "Docker", "CI/CD", "Distributed Systems", "Microservices"],
  },
  {
    label: "Languages & Databases",
    items: ["Python", "Kotlin", "Scala", "Java", "TypeScript / JavaScript", "Postgres", "MySQL", "MongoDB", "Redis"],
  },
  {
    label: "Management",
    items: ["People Management", "Hiring", "Growth Strategies", "Budgeting", "Pre-sales", "Customer Success", "Enterprise Architecture"],
  },
];

export const education = {
  school: "National Institute of Technology, Jamshedpur",
  degree: "B.Tech (Hons), Computer Science Engineering",
  start: "2003",
  end: "2007",
  detail: "Member of the Programming Society",
};

export interface Certification {
  name: string;
  issuer: string;
  period: string;
}

export const certifications: Certification[] = [
  {
    name: "Apache Ambari Committer",
    issuer: "The Apache Software Foundation",
    period: "Jan 2016 – Present",
  },
  {
    name: "Generative AI with Large Language Models",
    issuer: "DeepLearning.AI & AWS",
    period: "Mar 2024",
  },
];
