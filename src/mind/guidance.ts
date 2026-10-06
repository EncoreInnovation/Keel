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

/**
 * Testosterone and sexual health — the levers with real evidence behind
 * them, and an honest line on the ones without.
 */
export const SEXUAL_HEALTH_NOTES: Tip[] = [
  {
    id: 't-fat-loss',
    title: 'Fat loss is the biggest testosterone lever',
    body: 'Body fat converts testosterone to estrogen. In men carrying extra weight, losing it raises testosterone — more the more is lost.',
    source: 'Corona et al., Eur J Endocrinol 2013 (meta-analysis)',
  },
  {
    id: 't-sleep',
    title: 'Sleep protects testosterone',
    body: 'One week of 5-hour nights cut testosterone by 10–15% in healthy young men. Most testosterone is released during sleep.',
    source: 'Leproult & Van Cauter, JAMA 2011',
  },
  {
    id: 't-lifting',
    title: 'Lift heavy, don’t overtrain',
    body: 'Compound strength work supports healthy levels; chronic overtraining and crash dieting suppress them. The app’s autoregulation and deloads are built for exactly this.',
    source: 'Hackney, Endocrine 2020; Kraemer & Ratamess, Sports Med 2005',
  },
  {
    id: 't-micronutrients',
    title: 'Vitamin D and zinc — only if low',
    body: 'Correcting a real deficiency helps; topping up normal levels doesn’t. Get tested rather than guessing. Morning daylight helps vitamin D and sleep both.',
    source: 'Prasad et al., Nutrition 1996; Lerchbaum et al., Eur J Endocrinol 2017',
  },
  {
    id: 't-alcohol',
    title: 'Go easy on alcohol',
    body: 'Heavy drinking lowers testosterone and hurts sleep and erections. A couple of drinks is a different story from a lot.',
    source: 'Emanuele & Emanuele, Alcohol Health Res World 1998',
  },
  {
    id: 't-cardio',
    title: 'Erections run on blood flow',
    body: 'Erectile function shares risk factors with heart disease — waist size, blood pressure, blood sugar. Conditioning and fat loss help both.',
    source: 'Gandaglia et al., Eur Urol 2014',
  },
  {
    id: 't-pelvic',
    title: 'Train the pelvic floor',
    body: 'In trials, pelvic floor training restored or improved erections in most men with ED and gave most men with premature ejaculation control. It’s the Pelvic Floor session — 6 minutes, daily.',
    source: 'Dorey et al., BJU Int 2005; Pastore et al., Ther Adv Urol 2014',
  },
  {
    id: 't-boosters',
    title: 'Skip “T boosters”',
    body: 'Most testosterone-booster supplements have little or no evidence that they raise testosterone. If you have symptoms of low T, a morning blood test and a doctor are the real route.',
    source: 'Clemesha et al., World J Mens Health 2020',
  },
];

const ALL_TIPS = [...COACHING_TIPS, ...SEXUAL_HEALTH_NOTES];

/** One tip per calendar day, rotating through every note. */
export function tipForDay(now: number): Tip {
  const day = Math.floor(now / 86_400_000);
  return ALL_TIPS[day % ALL_TIPS.length]!;
}

export const TIP_COUNT = ALL_TIPS.length;
