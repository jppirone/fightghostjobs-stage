// phone-readings.js - the readings of the phone entry tests (prompt IB, November 3, 2026): the text a phone gives for a screenshot of a job card, and what the search page must show for it.
//   kind invented: made-up companies and titles (some copied from the sample readings of the browser extension at its tag reader-v1, which are made up too).
//   kind apple: the exact text Apple's own text reading gave for screenshots of PUBLIC job listings on John's phone (the extension's HV and HW prompts), copied from the same samples. No person's name is in any of them.
//   expect: the state (read or nothing), whether the text is cut at the cap, the three boxes, the number of the sentence under each box (2 cut off, 3 req in the title, 4 broken word, 5 not found; null for none) and the other openings offered, as "Title at Company".
// The expected values were checked by hand against the want values of the extension's own samples; they are plain values here so a test compares the PAGE with them, not the page with itself.
export const READINGS = [
 {
  "id": "I01",
  "kind": "invented",
  "name": "one card: title, company, place, pay, badge",
  "text": "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Contoso Freight",
   "query": "Senior Logistics Analyst",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I02",
  "kind": "invented",
  "name": "two cards in one screenshot",
  "text": "Route Planner\nBluebird Logistics\nDenver, CO\nViewed\nWarehouse Supervisor\nHarbor Light Foods\nChicago, IL\nPromoted",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Bluebird Logistics",
   "query": "Route Planner",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Warehouse Supervisor at Harbor Light Foods"
   ]
  }
 },
 {
  "id": "I03",
  "kind": "invented",
  "name": "three public cards in one screenshot",
  "text": "Manager, Integration Delivery -\nProfessional Services •\nMaintainX\nMiami, FL (Hybrid)\n$100K/yr - $162K/yr\nYou'd be a top applicant\nViewed\nStrategy & Transformation\nManager\nDeloitte\nJacksonville, FL (Hybrid)\n283 school alumni work here\nPromoted · Be an early applicant\nM&A Integration Manager\nCrowe\nMiami, FL\nYou'd be a top applicant\n1 week ago",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "MaintainX",
   "query": "Manager, Integration Delivery - Professional Services",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Strategy & Transformation Manager at Deloitte",
    "M&A Integration Manager at Crowe"
   ]
  }
 },
 {
  "id": "I04",
  "kind": "invented",
  "name": "a requisition number in brackets at the end of the title (found in the title, not labelled)",
  "text": "Program Manager (R12345)\nNorthwind Foods\nTampa, FL\nViewed",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Northwind Foods",
   "query": "Program Manager",
   "req": "R12345",
   "notes": {
    "company": null,
    "query": null,
    "req": 3
   },
   "others": []
  }
 },
 {
  "id": "I05",
  "kind": "invented",
  "name": "a title that ends with dots (cut off by the screen)",
  "text": "Manager, Integration Delivery - Profes...\nMaintainX\nMiami, FL (Hybrid)",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "MaintainX",
   "query": "Manager, Integration Delivery - Profes",
   "req": "",
   "notes": {
    "company": null,
    "query": 2,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I06",
  "kind": "invented",
  "name": "a company that ends with dots before a badge",
  "text": "Head of Artificial Intelligence\nForceV...\nEasy Apply",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "ForceV",
   "query": "Head of Artificial Intelligence",
   "req": "",
   "notes": {
    "company": 2,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I07",
  "kind": "invented",
  "name": "labels with a KIO ID",
  "text": "Company: Fabrikam Health\nTitle: Intake Coordinator\nKIO ID: KIO-A5R8-C2H9-M4V4",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Fabrikam Health",
   "query": "KIO-A5R8-C2H9-M4V4",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I08",
  "kind": "invented",
  "name": "labels Company, Role, Req ID",
  "text": "Company: Contoso Freight\nRole: Senior Logistics Analyst\nReq ID: 48213",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Contoso Freight",
   "query": "Senior Logistics Analyst",
   "req": "48213",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I09",
  "kind": "invented",
  "name": "a text with no job in it",
  "text": "Chocolate chip cookies\n2 cups flour\n1 cup butter\nBake for 12 minutes at 350 degrees",
  "expect": {
   "state": "nothing",
   "cut": false,
   "company": "",
   "query": "",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I10",
  "kind": "invented",
  "name": "a word broken in the middle of the title",
  "text": "Senior Procuremen\nt Analyst\nHarbor Light Foods\nChicago, IL\n$30 - $40 an hour",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Harbor Light Foods",
   "query": "",
   "req": "",
   "notes": {
    "company": null,
    "query": 4,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I11",
  "kind": "invented",
  "name": "two complete cards and a third cut by the bottom edge of the screen",
  "text": "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed\nRoute Planner\nBluebird Logistics\nDenver, CO (On-site)\nPromoted\nWarehouse Supervisor\nHarbor Light Foods\nDallas",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Contoso Freight",
   "query": "Senior Logistics Analyst",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Route Planner at Bluebird Logistics"
   ]
  }
 },
 {
  "id": "I12",
  "kind": "invented",
  "name": "a title longer than the 80 characters of the title box (shortened)",
  "text": "Senior Director of Global Supply Chain Planning and Strategic Sourcing Operations for North America\nContoso Freight\nAustin, TX\nViewed",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Contoso Freight",
   "query": "Senior Director of Global Supply Chain Planning and Strategic Sourcing",
   "req": "",
   "notes": {
    "company": null,
    "query": 2,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I13",
  "kind": "invented",
  "name": "a long screen: eight cards, the text is cut at 600 characters",
  "text": "Planner Number 1 Operations\nNorthwind Logistics Group 1\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 2 Operations\nNorthwind Logistics Group 2\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 3 Operations\nNorthwind Logistics Group 3\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 4 Operations\nNorthwind Logistics Group 4\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 5 Operations\nNorthwind Logistics Group 5\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 6 Operations\nNorthwind Logistics Group 6\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 7 Operations\nNorthwind Logistics Group 7\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed\nPlanner Number 8 Operations\nNorthwind Logistics Group 8\nDenver, CO (Hybrid)\n$70K/yr - $90K/yr\nViewed",
  "expect": {
   "state": "read",
   "cut": true,
   "company": "Northwind Logistics Group 1",
   "query": "Planner Number 1 Operations",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Planner Number 2 Operations at Northwind Logistics Group 2",
    "Planner Number 3 Operations at Northwind Logistics Group 3",
    "Planner Number 4 Operations at Northwind Logistics Group 4",
    "Planner Number 5 Operations at Northwind Logistics Group 5",
    "Planner Number 6 Operations at Northwind Logistics Group 6"
   ]
  }
 },
 {
  "id": "I14",
  "kind": "invented",
  "name": "only spaces and line breaks",
  "text": "   \n  \n ",
  "expect": {
   "state": "nothing",
   "cut": false,
   "company": "",
   "query": "",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "I15",
  "kind": "invented",
  "name": "two cards, the first with a requisition number in its title (the note belongs to the first card)",
  "text": "Program Manager (R12345)\nNorthwind Foods\nTampa, FL\nViewed\nRoute Planner\nBluebird Logistics\nDenver, CO (On-site)\nPromoted",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Northwind Foods",
   "query": "Program Manager",
   "req": "R12345",
   "notes": {
    "company": null,
    "query": null,
    "req": 3
   },
   "others": [
    "Route Planner at Bluebird Logistics"
   ]
  }
 },
 {
  "id": "I16",
  "kind": "invented",
  "name": "two cards, the first with a title cut off by dots (the note belongs to the first card)",
  "text": "Manager, Integration Delivery - Profes...\nMaintainX\nMiami, FL (Hybrid)\nRoute Planner\nBluebird Logistics\nDenver, CO (On-site)\nPromoted",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "MaintainX",
   "query": "Manager, Integration Delivery - Profes",
   "req": "",
   "notes": {
    "company": null,
    "query": 2,
    "req": null
   },
   "others": [
    "Route Planner at Bluebird Logistics"
   ]
  }
 },
 {
  "id": "A01",
  "kind": "apple",
  "name": "Glassdoor from an email: a logo line, a company over two lines with a rating",
  "text": "UNIVERSA\nUniversal Orlando\nResort 4.0 *\nProgram Manager (Advanced Technology Sustainment) -\n2-Year Project Role\nOrlando, FL\n$69K - $102K (Glassdoor est.) 1d",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Universal Orlando Resort",
   "query": "Program Manager (Advanced Technology Sustainment) - 2-Year Project Role",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "A02",
  "kind": "apple",
  "name": "LinkedIn app from a search: AI read as Al, an R number in the title",
  "text": "Al Transformation Program\nManager (R-19993) ©\nDun & Bradstreet\nJacksonville, FL (Hybrid)\nMedical, Vision, Dental, 401(k)\nActively reviewing applicants\n1 week ago • in\nEasy Apply",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Dun & Bradstreet",
   "query": "AI Transformation Program Manager",
   "req": "R-19993",
   "notes": {
    "company": null,
    "query": null,
    "req": 3
   },
   "others": []
  }
 },
 {
  "id": "A03",
  "kind": "apple",
  "name": "Indeed app at 100 percent",
  "text": "Implementation Specialist\nBlock, Inc.\nRemote in Seattle, WA\n$31.66 - $63.23 an hour",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Block, Inc.",
   "query": "Implementation Specialist",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "A04",
  "kind": "apple",
  "name": "Indeed app at a large text size: a word broken in the middle",
  "text": "Implementatio\nn Specialist\nBlock, Inc.\nRemote in Seattle,\nWA\n- $31.66 - $63.23 an\nhour",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "Block, Inc.",
   "query": "",
   "req": "",
   "notes": {
    "company": null,
    "query": 4,
    "req": null
   },
   "others": []
  }
 },
 {
  "id": "A05",
  "kind": "apple",
  "name": "LinkedIn app Jobs feed, full screen: four cards, a few characters over the cap",
  "text": "4:48 :\nDescribe the job you want\nun\nEnterprise Life Sciences CRM\nSolution Owner O\nSlalom\nMiami, FL\n401(k) benefit\n16 school alumni work here\nPromoted • Be an early applicant\nS\nSalesforce Health Cloud\nSolution Owner O\nSlalom\nMiami, FL\n401(k) benefit\n16 school alumni work here\nPromoted • Be an early applicant\nSr. Project Manager, IT - Central\n(A) O\nUniversity of Miami\nCoral Gables, FL\n11 school alumni work here\n2 months ago\nEY\nLife Sciences Supply Chain\nManufacturing Ops & Al\nTransformation Delivery - Senior\nEY\nMiami, FL\n401(k) benefit\nconnection works here\nHome\nJobs\nMy Network Notifications\nMore.",
  "expect": {
   "state": "read",
   "cut": true,
   "company": "Slalom",
   "query": "Enterprise Life Sciences CRM Solution Owner",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Salesforce Health Cloud Solution Owner at Slalom",
    "Sr. Project Manager, IT - Central at University of Miami",
    "Life Sciences Supply Chain Manufacturing Ops & AI Transformation Delivery at EY"
   ]
  }
 },
 {
  "id": "A06",
  "kind": "apple",
  "name": "ZipRecruiter from an email: two cards",
  "text": "Senior IT Project Manager - Healthcare\nPrograms\nAHU Technologies Inc • Washington, DC • On-site\n$83 - $88/hr\nBe Seen First\n1-Click Apply\nManager, Program/Project III\n: NIS\nNationwide IT Services • Fairfax,\nVA • Remote\n1-Click Apply",
  "expect": {
   "state": "read",
   "cut": false,
   "company": "AHU Technologies Inc",
   "query": "Senior IT Project Manager - Healthcare Programs",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Manager, Program/Project III at Nationwide IT Services"
   ]
  }
 },
 {
  "id": "A07",
  "kind": "apple",
  "name": "LinkedIn app Jobs feed with a fifth card cut by the screen and a long text",
  "text": "5:158\n三の\nQ Describe the job you want\nMiami, FL (Hybrid)\n2 months ago\nSr. Project Manager/BA\nIntegrated Home Care Services, Inc.\nHollywood,\nFL (Remote)\n401(k) benefit\n1 day ago • |\nEasy Apply\nSenior Project Manager - IT\n(Messaging & Collaboration) -\n#26-27638 • US Tech Solutions\nJuno Beach, FL (On-site)\n$50/hr - $55/hr\n1 school alumni works here\nPromoted • Be an early applicant\nEasy Apply\nQolo\nSenior Onboarding Project\nManager O\nQolo\nFort Lauderdale, FL (Remote)\nPromoted •\nEasy Apply\neMed\nImplementation Manager eMed\nMiami, FL (On-site)\n3 months ago •\nEasy Apply\nEY\nLife Sciences Supply Chain\nManufacturing Ops & Al\nTransformation Delivery- Senior\nManzaar\nHome\nJobs\nMy Network Notifications\nMore",
  "expect": {
   "state": "read",
   "cut": true,
   "company": "Integrated Home Care Services, Inc.",
   "query": "Sr. Project Manager/BA",
   "req": "",
   "notes": {
    "company": null,
    "query": null,
    "req": null
   },
   "others": [
    "Senior Project Manager - IT (Messaging & Collaboration) at US Tech Solutions",
    "Senior Onboarding Project Manager at Qolo",
    "Implementation Manager at eMed"
   ]
  }
 }
];
