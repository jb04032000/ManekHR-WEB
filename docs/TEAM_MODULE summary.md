Dependency Map - What Salary Compliance Needs from Team Module
Salary RequirementIn Team ModuleStatusName✅ nameCompleteBank details✅ bankDetailsCompleteDate of joining✅ dateOfJoiningCompleteDate of resignation / LWD✅ dateOfResignationCompleteGender✅ genderCompleteAddress⚠️ address (single string)Partial - needs state extraction for PTPAN number❌ MissingCritical - TDS cannot be computedUAN number❌ MissingCritical - PF ECR filing blockedTax regime (old/new)❌ MissingCritical - TDS engine inputState of employment❌ MissingCritical - PT slab selectionEmployment type (FT/contract/intern)❌ MissingCritical - PF/ESI applicability differsPF applicability flag❌ MissingCritical - some employees exempt/opted outESI applicability flag❌ MissingComputed from gross but needs overrideESI IP number❌ MissingHigh - ESI filingMarital status❌ MissingMedium - affects HRA calculation pathPrevious employer TDS (Form 12B)❌ MissingHigh - new joiners mid-yearNominee details (Form 2)❌ MissingMedium - PF nominationDisability status❌ MissingLow - Section 80U exemption

Team Module Gap Table (Compliance-Critical Only)
GapSeverityBlocksPAN number🔴 CriticalTDS deduction, Form 16, Form 24QUAN number🔴 CriticalPF deduction display, ECR fileTax regime selection🔴 CriticalTDS computation engineState of employment🔴 CriticalPT slab lookupEmployment type enum🔴 CriticalPF/ESI/TDS applicability rulesPF applicable flag + opt-out🔴 CriticalPF deduction logicESI IP number🟡 HighESI challanPrevious employer TDS (Form 12B fields)🟡 HighAccurate TDS for mid-year joinersMarital status🟡 HighHRA exemption (rented vs owned house check)Nominee details🟢 MediumPF Form 2

Phased Implementation Roadmap
Phase 1 - Must do before any compliance sprint (1–2 days)
These are pure data fields on TeamMember + MemberDetailDrawer UI:

pan (string, masked display)
uan (string)
taxRegime: 'old' | 'new'
stateOfEmployment (string - Indian state enum)
employmentType: 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant'
pfApplicable: boolean + pfOptedOut: boolean
esiIpNumber (string, conditional on ESI applicability)

Phase 2 - Alongside Salary Compliance Sprint B/C

maritalStatus
Previous employer TDS fields (prev employer name, TDS deducted Apr–joining month, gross salary prev employer) - a sub-document
Separate workState properly from the freeform address string

Phase 3 - Parallel or post Salary MVP

Nominee details (PF Form 2)
Document management (IT declaration uploads, Form 2 PDFs)
Probation tracking + confirmation workflow

Phase 4 - Future scope

Reporting manager hierarchy (approval workflows)
Department/cost center (accounting integration)
Rehire handling

Final Recommendation
Do Phase 1 first - it's a single focused sprint on data model extension. Add 8–10 fields to TeamMember schema, update MemberDetailDrawer (Work tab - new "Compliance & Tax" section), and expose them via the existing PATCH endpoint. This is 2–3 days of CLI agent work max and unblocks all compliance salary sprints cleanly.
The biggest risks if you skip this: TDS engine has no PAN → Form 16 is invalid; PF ECR has no UAN → EPFO portal rejects the file; PT deduction applies wrong slab → wrong state used.
