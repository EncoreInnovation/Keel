/**
 * Trainer guidance that isn't tracked — the levers outside the gym that
 * decide whether a 20%+ body-fat lifter ends Q4 looking denser and leaner.
 * Each line names its source so it can be checked rather than taken on
 * trust. General information, not medical advice.
 */

export interface Tip {
  id: string;
  title: string;
  body: string;
  source: string;
}

export const COACHING_TIPS: Tip[] = [
  {
    id: 'protein',
    title: 'Protein first',
    body: 'Aim for about 1 g per pound of goal bodyweight — roughly 220–240 g a day. In a calorie deficit, high protein is what makes the weight you lose fat instead of muscle.',
    source: 'Morton et al., Br J Sports Med 2018; Helms et al., JISSN 2014',
  },
  {
    id: 'deficit',
    title: 'A moderate deficit',
    body: 'About 500 kcal a day under maintenance, losing 0.5–1% of bodyweight a week. Faster than that, on top of lifting and Insanity, costs muscle and strength.',
    source: 'Helms et al., JISSN 2014; Garthe et al., IJSNEM 2011',
  },
  {
    id: 'steps',
    title: '8–10k steps',
    body: 'Daily walking burns real calories without eating into recovery the way more HIIT does. Health benefits keep rising up to roughly 8–10k steps a day.',
    source: 'Paluch et al., Lancet Public Health 2022',
  },
  {
    id: 'sleep',
    title: 'Sleep is training',
    body: '7–9 hours. Early sessions mean an earlier bedtime. In one diet study, short sleep made people lose 55% less fat and more muscle on the same calories.',
    source: 'Watson et al., Sleep 2015; Nedeltcheva et al., Ann Intern Med 2010',
  },
  {
    id: 'insanity',
    title: 'Insanity at your size',
    body: 'Use the low-impact modifications for the first 2–3 weeks and keep it away from the day before heavy legs. It covers your jump volume — the app trims plyometrics after it.',
    source: 'Coaching guidance; landing forces scale with bodyweight',
  },
  {
    id: 'physical',
    title: 'Get checked',
    body: 'Before high-intensity work at your size: a physical plus bloodwork — blood pressure, lipids, A1c, and a morning testosterone panel. It’s quick, and you’ll know your baseline.',
    source: 'ACSM pre-participation screening guidance (Riebe et al., MSSE 2015)',
  },
  {
    id: 'creatine',
    title: 'Creatine monohydrate',
    body: '3–5 g a day, any time. The best-supported supplement for strength and muscle. Check with your doctor first if you have kidney issues.',
    source: 'ISSN position stand, Kreider et al., JISSN 2017',
  },
  {
    id: 'waist',
    title: 'Trust the waist',
    body: 'Scale weight swings with water, salt and running. A shrinking waist with stable or rising lifts is fat loss with muscle kept — the exact change you want.',
    source: 'Coaching guidance',
  },
];

/** One tip per calendar day, rotating through the list. */
export function tipForDay(now: number): Tip {
  const day = Math.floor(now / 86_400_000);
  return COACHING_TIPS[day % COACHING_TIPS.length]!;
}
