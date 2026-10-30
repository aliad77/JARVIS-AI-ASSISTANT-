/** Local safety backstop (port of backend/app/ai/safety.py). English keyword based; see docs/SECURITY.md. */

const CRISIS = /\b(?:kill(?:ing)? myself|suicid\w*|end my life|want to die|self[- ]?harm\w*|hurt(?:ing)? myself|cut(?:ting)? myself)\b/i;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const PHONE = /(?<!\w)(?:\+?\d[\s().-]?){9,14}\d(?!\w)/;

export const CRISIS_REPLY =
  "I'm really glad you told me. What you're feeling matters, and you deserve support from a real person right now. " +
  "Please talk to a trusted adult — a parent, family member, teacher, or school counselor — as soon as you can.\n\n" +
  "If you might be in danger, contact your local emergency number right away. Many countries also have free, confidential " +
  "helplines for young people (for example, in the US you can call or text **988**, and in the UK you can call **Childline on 0800 1111**).\n\n" +
  "I'm a study buddy app, so I can't give you the help a real person can — but you don't have to go through this alone.";

export const PERSONAL_INFO_NOTE =
  "(Quick tip: it looks like you shared an email or phone number. It's safest not to share personal details in apps or online.)";

export function screen(text: string): { crisis: boolean; personalInfo: boolean } {
  return { crisis: CRISIS.test(text), personalInfo: EMAIL.test(text) || PHONE.test(text) };
}
