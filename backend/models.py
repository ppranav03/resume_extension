from dataclasses import dataclass


@dataclass
class Job:
    company: str
    role: str


@dataclass
class JobProfile:
    index: int  # which posting in the batch this describes
    company: str
    role: str
    duties: list[str]
    skills: list[str]


@dataclass
class ClusterLabel:
    id: int
    label: str
