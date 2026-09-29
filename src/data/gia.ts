// PM-AJAY — GIA (Grant-in-Aid) component benefit mapping used by the
// recommendation engine to link each pathway to financial support.
import type { GIABenefit } from "@/lib/types";

export const GIA_BENEFITS: GIABenefit[] = [
  {
    id: "gia-skill",
    title: "Skill Training Support (NSQF-aligned)",
    titleHi: "कौशल प्रशिक्षण सहायता",
    amount: "Up to ₹25,000 course fee support",
    appliesTo: ["training"],
    description:
      "Free or subsidised NSQF-aligned training through GIA-supported NGOs/institutions, including course fee, study material and assessment cost.",
  },
  {
    id: "gia-stipend",
    title: "Wage Compensation During Training",
    titleHi: "प्रशिक्षण काल वेतन-भरपाई",
    amount: "₹1,000 – 3,000 / month stipend",
    appliesTo: ["training", "wage-comp"],
    description:
      "Monthly stipend / wage compensation for SC trainees so daily earners don't lose income while attending skill programmes.",
  },
  {
    id: "gia-toolkit",
    title: "Toolkit / Equipment Grant",
    titleHi: "टूलकिट / उपकरण अनुदान",
    amount: "Toolkit worth ₹5,000 – 15,000",
    appliesTo: ["toolkit", "self"],
    description:
      "Post-certification starter toolkit (e.g., mobile-repair kit, sewing machine, leather tools) for trainees who complete placement or start self-employment.",
  },
  {
    id: "gia-rpl",
    title: "RPL Certification Support",
    titleHi: "पूर्व अनुभव प्रमाणण (RPL) सहायता",
    amount: "Free RPL assessment + ₹500 / day during assessment",
    appliesTo: ["rpl"],
    description:
      "Recognition of Prior Learning assessment fee coverage and short bridge training for workers with informal/traditional skills.",
  },
  {
    id: "gia-enterprise",
    title: "Income-Generating Enterprise Capital",
    titleHi: "आय-सृजन उद्यम पूंजी सहायता",
    amount: "Project-based capital support via GIA proposals",
    appliesTo: ["self"],
    description:
      "Seed capital / revolving-fund support routed through State Channelising Agencies (SCA) and NSFDC concessional loans for SC micro-entrepreneurs.",
  },
  {
    id: "gia-hostel",
    title: "Residential Training Facility",
    titleHi: "आवासीय प्रशिक्षण सुविधा",
    amount: "Free boarding & lodging during training",
    appliesTo: ["training"],
    description:
      "For traineesmobility-constrained beneficiaries, GIA projects can include residential facilities and travel support.",
  },
];

export function giaFor(opts: { rpl: boolean; selfEmpPath: boolean; trainingNeeded: boolean }): { title: string; amount: string }[] {
  const out: { title: string; amount: string }[] = [];
  const push = (id: string) => {
    const g = GIA_BENEFITS.find((b) => b.id === id);
    if (g && !out.some((o) => o.title === g.title)) out.push({ title: g.title, amount: g.amount });
  };
  if (opts.rpl) push("gia-rpl");
  if (opts.trainingNeeded) { push("gia-skill"); push("gia-stipend"); }
  if (opts.selfEmpPath) { push("gia-toolkit"); push("gia-enterprise"); }
  return out;
}
