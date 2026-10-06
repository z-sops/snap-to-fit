import type { Profile } from "./model";
import type { Allergen, MacroBudget } from "./planning-types";
import { nutritionTargets } from "./nutrition";
import { dietaryType, hasOtherAllergy } from "./meal-planning";
const aliases: Record<Allergen, RegExp> = {
  milk: /milk|cheese|paneer|yog[hu]urt|dahi|cream|whey|butter/i,
  egg: /\begg(s)?\b|omelette|mayonnaise/i,
  fish: /\bfish\b|salmon|tuna/i,
  shellfish: /prawn|shrimp|crab|lobster/i,
  wheat: /roti|chapati|bread|toast|pasta|pizza|burger|naan|seitan|bulgur/i,
  soy: /soya?|tofu|tempeh/i,
  peanut: /peanut|groundnut/i,
  "tree-nut": /almond|walnut|cashew|pistachio/i,
  sesame: /sesame|tahini/i,
};
export interface FoodReview {
  requiresReview: boolean;
  messages: string[];
  alternative: string;
}
export function foodReview(
  p: Profile,
  meal: { name: string; carbs: number },
  reference?: Partial<MacroBudget>,
  loggedCarbs = 0,
): FoodReview {
  const messages: string[] = [];
  const medical = nutritionTargets(p).restricted;
  if (medical)
    messages.push(
      "Review this estimate against your existing care plan. A photo cannot determine current glucose response, added salt or medication interactions.",
    );
  if(p.allergyFoods?.length)messages.push('Your selected food allergies need a recipe, label and cross-contact check. An unrecognized ingredient is not evidence that an allergen is absent.');
  for (const allergen of p.allergyFoods || [])
    if (aliases[allergen].test(meal.name))
      messages.push(
        `Possible ${allergen} ingredient in the estimated name. Check the label, recipe and cross-contact; do not use a photo to rule out an allergen.`,
      );
  if (hasOtherAllergy(p))
    messages.push(
      "Your recorded allergy restrictions need an ingredient and cross-contact check. Photo recognition cannot clear them.",
    );
  const diet = dietaryType(p);
  if (
    diet === "vegan" &&
    /chicken|beef|mutton|turkey|fish|salmon|tuna|egg|milk|cheese|paneer|yog[hu]urt|dahi|whey|butter|honey/i.test(
      meal.name,
    )
  )
    messages.push(
      "The estimate may contain an animal ingredient. Verify a vegan substitution before choosing it.",
    );
  if (
    diet === "vegetarian" &&
    /chicken|beef|mutton|turkey|fish|salmon|tuna|prawn|shrimp/i.test(meal.name)
  )
    messages.push(
      "The estimate may contain meat or seafood. Check a vegetarian substitution.",
    );
  if (
    (p.conditions.includes("type1") ||
      p.conditions.includes("type2") ||
      p.insulin) &&
    /jalebi|halwa|sweet|sugar|soda|juice|cake|dessert|mithai|candy/i.test(
      meal.name,
    )
  )
    messages.push(
      "This may be a sweetened food. Review the estimated carbohydrate amount and portion with your existing plan; the app cannot predict a dangerous spike from its image.",
    );
  if (
    reference?.carbs !== undefined &&
    meal.carbs + loggedCarbs > reference.carbs
  )
    messages.push(
      `This estimate plus today’s logged carbs exceeds your entered ${reference.carbs} g daily reference. The reference is not a medication or meal-safety decision.`,
    );
  return {
    requiresReview: messages.length > 0,
    messages,
    alternative: medical
      ? "Review an alternative already included in your own care plan."
      : "Choose an ingredient-confirmed alternative from your weekly plan and adjust its portions.",
  };
}
