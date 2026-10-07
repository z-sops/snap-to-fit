import type { Profile } from "./model";

// Product scope limits, not a clinical assessment or clearance to exercise.
export function exerciseRestricted(p: Profile) {
  return p.conditions.length > 0 || p.insulin || !!p.medicines.trim() ||
    !!p.injuries.trim() || p.weight / (p.height / 100) ** 2 < 18.5 || p.age > 78;
}

export function restrictedHealthAdvice(text: string): string | null {
  if (/\b(anabolic|steroids?|testosterone|trenbolone|anavar|dianabol|sarms?|post.?cycle|pct)\b/i.test(text) &&
      /\b(dos(e|es|ing|age)|stack(s|ing)?|cycle(s|ing)?|protocol|mg|units|how (much|to use)|take|inject|taper)\b/i.test(text))
    return "I cannot provide anabolic-steroid misuse doses, stacks, cycles or post-cycle protocols. Misuse can cause serious harm. Discuss your use with a clinician; do not stop or change prescribed steroid medicines on your own.";
  if (/\b(ovulat\w*|fertil\w*|contracept\w*|safe days?|pregnan\w*|pcos)\b/i.test(text) &&
      /\b(predict\w*|calculat\w*|diagnos\w*|detect\w*|am i|chance|risk|window|days?|avoid|prevent|confirm|when)\b/i.test(text))
    return "Snap to Fit cannot determine ovulation, fertile or safe days, pregnancy probability or a PCOS diagnosis. Do not use its estimates for contraception or conception decisions. Ask a qualified clinician about reproductive health or testing.";
  return null;
}

export function urgentMessage(text: string): string | null {
  if (
    /chest (pain|pressure|tightness)|cannot breathe|can.t breathe|faint(ed|ing)?|unconscious|stroke|severe abdominal pain|vomiting blood/i.test(
      text,
    )
  )
    return "Stop exercising. These symptoms may require urgent medical attention. Contact your local emergency service now; do not wait for a chat response.";
  if (/\b(low (blood )?(sugar|glucose)|hypoglyc|sugar crash)/i.test(text))
    return "Pause activity, check your glucose if possible, and follow your prescribed low-glucose action plan. If you cannot safely swallow, are confused, faint, or symptoms are severe, get emergency help. Snap to Fit cannot adjust your insulin.";
  return null;
}
export function medicationRequest(text: string) {
  return (
    /\b(stop|skip|increase|decrease|change|reduce|taper|break|dose|units)\b/i.test(
      text,
    ) &&
    /\b(insulin|injection|ozempic|wegovy|mounjaro|medicine|medication|semaglutide|tirzepatide)\b/i.test(
      text,
    )
  );
}

export const doctorNotice =
  "Share this with your doctor. Apply these suggestions as advised by your doctor.";
export const steroidNotice =
  "Avoid non-prescribed anabolic steroids. Misuse can harm your heart, hormones, liver and kidneys. Do not change prescribed steroid medicines on your own.";
