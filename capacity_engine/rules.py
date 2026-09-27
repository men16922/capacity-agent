"""Versioned supported formulas and input contracts. No expression evaluation."""

from fractions import Fraction as F
from functools import reduce
from operator import mul

VERSION = "1.0.0"
PROFILE = "tta-r3-2023"
NETWORK = "lecture-network"


# Input unit, minimum, maximum, integer-only. Bounds are product domain guards;
# ranges stated as general guidance by TTA generate warnings separately.
def spec(unit="factor", minimum="1", maximum=None, integer=False):
    return {"unit": unit, "minimum": minimum, "maximum": maximum, "integer": integer}


SPECS = {
    "TTA-WEB-CPU": {
        **{f"S{i}": spec() for i in range(3, 10)},
        "S1": spec("users", "0", integer=True),
        "S2": spec("ops/user/s", "0"),
        "S4": spec("factor", "0.7", "2"),
        "S10": spec("ratio", "0", "1"),
        "S11": spec("factor", "24", "31"),
    },
    "TTA-OLTP-CPU": {
        **{f"O{i}": spec() for i in range(2, 10)},
        "O1": spec("transactions/min", "0"),
        "O10": spec("ratio", "0", "1"),
    },
    "TTA-MEMORY": {
        "M1": spec("capacity", "0"),
        "M2": spec("capacity/user", "0"),
        "M3": spec("users", "0", integer=True),
        "M4": spec(),
        "M5": spec("capacity", "0"),
        "M6": spec(),
    },
    "TTA-SYSTEM-DISK": {
        **{f"D{i}": spec("capacity", "0") for i in (1, 2, 3)},
        **{f"D{i}": spec() for i in (4, 5, 8)},
    },
    "TTA-DATA-DISK": {
        **{f"D{i}": spec("capacity", "0") for i in (6, 7)},
        **{f"D{i}": spec() for i in (4, 5, 8)},
    },
    "TTA-OLTP-IOPS": {"oltp_tpmC": spec("tpmC", "0")},
    "TTA-BATCH-IOPS": {"batch_tpmC": spec("tpmC", "0")},
    "NET-BANDWIDTH": {
        "traffic_bytes": spec("B", "0"),
        "transfer_seconds": spec("s", "0"),
    },
    "NET-DOWNLINK-PORTS": {
        "required_ports": spec("ports", "0", integer=True),
        "expansion_factor": spec(),
        "stability_factor": spec(),
    },
    "NET-UPLINK": {
        "downlink_gbps": spec("Gbps", "0"),
        "downlink_ports": spec("ports", "0", integer=True),
        "role_factor": spec("factor", "0"),
    },
    "NET-SWITCHING": {"all_port_gbps": spec("Gbps-list", "0")},
}
ARCHITECTURES = {
    "role-only": {
        "WEB": ("TTA-WEB-CPU", "1"),
        "WAS": ("TTA-WEB-CPU", "1"),
        "DB": ("TTA-OLTP-CPU", "1"),
    },
    "single-tier": {"WEB_WAS_DB": ("TTA-OLTP-CPU", "2.1")},
    "two-tier-webwas-db": {
        "WEB_WAS": ("TTA-WEB-CPU", "1.6"),
        "DB": ("TTA-OLTP-CPU", "1"),
    },
    "two-tier-web-wasdb": {
        "WEB": ("TTA-WEB-CPU", "1"),
        "WAS_DB": ("TTA-OLTP-CPU", "1.7"),
    },
    "three-tier": {
        "WEB": ("TTA-WEB-CPU", "1"),
        "WAS": ("TTA-WEB-CPU", "1"),
        "DB": ("TTA-OLTP-CPU", "1"),
    },
}
UNIT_FACTORS = {
    "Composite": {"x86": "29", "general": "30", "unix": "31"},
    "MultiJVM": {"x86": "24", "general": "25", "unix": "26"},
}
GUIDANCE = {
    "TTA-WEB-CPU": {
        "S2": ("3", "6"),
        "S5": ("1.1", "1.2"),
        "S6": ("1.2", "1.5"),
        "S7": ("1", "1.3"),
        "S8": ("1", "1.5"),
        "S9": ("1.3", "1.3"),
        "S10": ("0.7", "0.7"),
    },
    "TTA-OLTP-CPU": {
        "O3": ("1.2", "1.5"),
        "O4": ("1.5", "2"),
        "O7": ("1", "1.2"),
        "O8": ("1", "1.5"),
        "O9": ("1.3", "1.3"),
        "O10": ("0.7", "0.7"),
    },
    "TTA-MEMORY": {"M4": ("1.1", "1.3"), "M6": ("1.3", "1.3")},
    "TTA-SYSTEM-DISK": {"D4": ("1.1", "1.1"), "D5": ("1", "1.5")},
    "TTA-DATA-DISK": {"D4": ("1.1", "1.1"), "D5": ("1", "1.5")},
}


def evaluate(rule, v):
    if rule.startswith("GUIDE-"):
        return evaluate_guide(rule, v)
    if rule == "TTA-WEB-CPU":
        return reduce(mul, (v[f"S{i}"] for i in range(1, 10))) / (v["S10"] * v["S11"])
    if rule == "TTA-OLTP-CPU":
        return reduce(mul, (v[f"O{i}"] for i in range(1, 10))) / v["O10"]
    if rule == "TTA-MEMORY":
        return (v["M1"] + v["M2"] * v["M3"] + v["M5"]) * v["M4"] * v["M6"]
    if rule == "TTA-SYSTEM-DISK":
        return (v["D1"] + v["D2"] + v["D3"]) * v["D4"] * v["D5"] * v["D8"]
    if rule == "TTA-DATA-DISK":
        return (v["D6"] + v["D7"]) * v["D4"] * v["D5"] * v["D8"]
    if rule == "TTA-OLTP-IOPS":
        return v["oltp_tpmC"] * F(3, 100)
    if rule == "TTA-BATCH-IOPS":
        return v["batch_tpmC"] * F(1, 100)
    if rule == "NET-BANDWIDTH":
        return v["traffic_bytes"] * 8 / v["transfer_seconds"]
    if rule == "NET-DOWNLINK-PORTS":
        return v["required_ports"] * v["expansion_factor"] * v["stability_factor"]
    if rule == "NET-UPLINK":
        return v["downlink_gbps"] * v["downlink_ports"] * v["role_factor"]
    if rule == "NET-SWITCHING":
        return sum(v["all_port_gbps"], F(0)) * 2
    raise ValueError("Unsupported formula.")


# 2021-11 user guide citing TTAK.KO-01.0103/R1, kept separate from lecture rules.
GUIDE = "network-guide-2021"
SPECS.update(
    {
        "GUIDE-ACCESS-PORTS": {
            "required_ports": spec("ports", "0", integer=True),
            "expansion_factor": spec("factor", "1", "2"),
            "stability_factor": spec("factor", "1", "1.5"),
        },
        "GUIDE-ACCESS-UPLINK": {
            "downlink_gbps": spec("Gbps", "0"),
            "downlink_ports": spec("ports", "0", integer=True),
            "role_factor": spec("factor", "0", "1"),
        },
        "GUIDE-UPLINK-PORTS": {
            "required_uplink_gbps": spec("Gbps", "0"),
            "uplink_port_gbps": spec("Gbps", "0"),
            "redundancy_factor": spec("factor", "1", "2", integer=True),
        },
        "GUIDE-ACCESS-SWITCHING": {"all_port_gbps": spec("Gbps-list", "0")},
        "GUIDE-ACCESS-PPS": {"all_port_gbps": spec("Gbps-list", "0")},
        "GUIDE-BACKBONE-SWITCHING": {
            "all_port_gbps": spec("Gbps-list", "0"),
            "expansion_factor": spec("factor", "1", "2"),
            "stability_factor": spec("factor", "1", "1.5"),
        },
        "GUIDE-BACKBONE-PPS": {
            "all_port_gbps": spec("Gbps-list", "0"),
            "expansion_factor": spec("factor", "1", "2"),
            "stability_factor": spec("factor", "1", "1.5"),
        },
        "GUIDE-TARGET-SESSIONS": {
            "peak_sessions": spec("sessions", "0", integer=True),
            "growth_rate": spec("ratio", "0"),
        },
        "GUIDE-L47-THROUGHPUT": {
            "target_sessions": spec("sessions", "0", integer=True),
            "average_session_bytes": spec("B/session", "0"),
            "average_session_seconds": spec("s", "0"),
            "expansion_factor": spec(),
        },
        "GUIDE-WDM-CAPACITY": {
            "all_port_gbps": spec("Gbps-list", "0"),
            "growth_rate": spec("ratio", "0"),
            "expansion_factor": spec(),
        },
    }
)
# Only dimensionally valid, same-system edges are accepted. Port/session counts
# are rounded upward before the next stage, while performance values stay exact.
REFERENCE_TARGETS = {
    ("TTA-OLTP-IOPS", "oltp_tpmC"): ("TTA-OLTP-CPU", False),
    ("TTA-BATCH-IOPS", "batch_tpmC"): ("TTA-OLTP-CPU", False),
    ("GUIDE-ACCESS-UPLINK", "downlink_ports"): ("GUIDE-ACCESS-PORTS", True),
    ("GUIDE-UPLINK-PORTS", "required_uplink_gbps"): ("GUIDE-ACCESS-UPLINK", False),
    ("GUIDE-L47-THROUGHPUT", "target_sessions"): ("GUIDE-TARGET-SESSIONS", True),
}


def evaluate_guide(rule, v):
    if rule == "GUIDE-ACCESS-PORTS":
        return v["required_ports"] * v["expansion_factor"] * v["stability_factor"]
    if rule == "GUIDE-ACCESS-UPLINK":
        return v["downlink_gbps"] * v["downlink_ports"] * v["role_factor"]
    if rule == "GUIDE-UPLINK-PORTS":
        demand = v["required_uplink_gbps"] / v["uplink_port_gbps"]
        return F(-(-demand.numerator // demand.denominator)) * v["redundancy_factor"]
    if rule in ("GUIDE-ACCESS-SWITCHING", "GUIDE-ACCESS-PPS"):
        return sum(v["all_port_gbps"], F(0)) * (
            2 if rule.endswith("SWITCHING") else 1488095
        )
    if rule in ("GUIDE-BACKBONE-SWITCHING", "GUIDE-BACKBONE-PPS"):
        return (
            sum(v["all_port_gbps"], F(0))
            * v["expansion_factor"]
            * v["stability_factor"]
            * (2 if rule.endswith("SWITCHING") else 1488095)
        )
    if rule == "GUIDE-TARGET-SESSIONS":
        return v["peak_sessions"] * (1 + v["growth_rate"])
    if rule == "GUIDE-L47-THROUGHPUT":
        return (
            v["target_sessions"]
            * v["average_session_bytes"]
            * 8
            / v["average_session_seconds"]
            * v["expansion_factor"]
        )
    if rule == "GUIDE-WDM-CAPACITY":
        return (
            sum(v["all_port_gbps"], F(0))
            * (1 + v["growth_rate"])
            * v["expansion_factor"]
        )
    raise ValueError("Unsupported guide formula.")
