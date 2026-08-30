import type { CardDeck } from '../types/game';
import type { ObjectAnomalyId } from './objectAnomalies';

export type CardEffect =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'moveTo'; tileId: number }
  | { type: 'moveToNearestTunnel' }
  | { type: 'moveToNearestUtility' }
  | { type: 'moveBackSpaces'; spaces: number }
  | { type: 'goToJail' }
  | { type: 'getOutOfJailFree' }
  | { type: 'collectFromEachPlayer'; amount: number }
  | { type: 'payEachPlayer'; amount: number }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'objectAnomaly'; objectId: ObjectAnomalyId };

export interface CardDefinition {
  id: string;
  deck: CardDeck;
  title: string;
  text: string;
  effect: CardEffect;
}

// Standard classic Monopoly card effects, reskinned to SCP flavor - see
// CONTEXT.md's Cards section. Every card automates its effect directly
// (no read-it-aloud cards); "Get Out of Containment Free" and Object
// Anomaly cards are both held (see GamePlayerState.heldCardIds) rather
// than resolved immediately - see data/objectAnomalies.ts and
// engine.ts's useGamersFuel/useBadComposition/useCountermeasure.
export const ANOMALOUS_EVENT_CARDS: CardDefinition[] = [
  {
    id: 'realityAnchorMalfunction',
    deck: 'anomalousEvent',
    title: 'Reality Anchor Malfunction',
    text: 'Advance to the Site Entrance. Collect your Foundation Credits as you pass.',
    effect: { type: 'moveTo', tileId: 0 },
  },
  {
    id: 'emergencySiteTransfer',
    deck: 'anomalousEvent',
    title: 'Emergency Site Transfer',
    text: 'Advance to Site-01.',
    effect: { type: 'moveTo', tileId: 39 },
  },
  {
    id: 'requisitionOrder',
    deck: 'anomalousEvent',
    title: 'Requisition Order',
    text: 'Advance to the nearest Maintenance Tunnel. If unowned, you may buy it. If owned, pay the owner double the usual toll.',
    effect: { type: 'moveToNearestTunnel' },
  },
  {
    id: 'powerGridFailure',
    deck: 'anomalousEvent',
    title: 'Power Grid Failure',
    text: 'Advance to the nearest utility. If unowned, you may buy it. If owned, roll the dice and pay the owner ten times the total.',
    effect: { type: 'moveToNearestUtility' },
  },
  {
    id: 'hazardPayBonus',
    deck: 'anomalousEvent',
    title: 'Hazard Pay Bonus',
    text: 'Collect 50 Foundation Credits.',
    effect: { type: 'collect', amount: 50 },
  },
  {
    id: 'clearanceRevokedAnomalous',
    deck: 'anomalousEvent',
    title: 'Clearance Revoked',
    text: 'This card may be kept until needed, or sold. Get Out of the Containment Chamber Free.',
    effect: { type: 'getOutOfJailFree' },
  },
  {
    id: 'emergencyRecall',
    deck: 'anomalousEvent',
    title: 'Emergency Recall',
    text: 'Go back 3 spaces.',
    effect: { type: 'moveBackSpaces', spaces: 3 },
  },
  {
    id: 'containmentBreachAnomalous',
    deck: 'anomalousEvent',
    title: 'Containment Breach',
    text: 'Go directly to the Containment Chamber. Do not pass the Site Entrance, do not collect 200 Credits.',
    effect: { type: 'goToJail' },
  },
  {
    id: 'structuralDamageAssessment',
    deck: 'anomalousEvent',
    title: 'Structural Damage Assessment',
    text: 'Make general repairs on all your Wings: 25 Credits per house, 100 Credits per hotel.',
    effect: { type: 'repairs', perHouse: 25, perHotel: 100 },
  },
  {
    id: 'hazardZoneFine',
    deck: 'anomalousEvent',
    title: 'Hazard Zone Fine',
    text: 'Pay a fine of 15 Foundation Credits.',
    effect: { type: 'pay', amount: 15 },
  },
  {
    id: 'advanceToO5Chamber',
    deck: 'anomalousEvent',
    title: 'Summoned to the O5 Council Chamber',
    text: 'Advance to the O5 Council Chamber.',
    effect: { type: 'moveTo', tileId: 37 },
  },
  {
    id: 'mandatoryTeamBuildingRetreat',
    deck: 'anomalousEvent',
    title: 'Mandatory Team-Building Retreat',
    text: "You're funding it. Pay each other player 50 Foundation Credits.",
    effect: { type: 'payEachPlayer', amount: 50 },
  },
  {
    id: 'crossClassPromotion',
    deck: 'anomalousEvent',
    title: 'Cross-Class Promotion',
    text: 'Collect 150 Foundation Credits.',
    effect: { type: 'collect', amount: 150 },
  },
  {
    id: 'realityBleed',
    deck: 'anomalousEvent',
    title: 'Reality Bleed',
    text: 'Move back 5 spaces.',
    effect: { type: 'moveBackSpaces', spaces: 5 },
  },
  {
    id: 'lockdownProtocol',
    deck: 'anomalousEvent',
    title: 'Lockdown Protocol',
    text: 'Go directly to the Containment Chamber. Do not pass the Site Entrance, do not collect 200 Credits.',
    effect: { type: 'goToJail' },
  },
  {
    id: 'anomalousMaterialsShipment',
    deck: 'anomalousEvent',
    title: 'Anomalous Materials Shipment',
    text: 'Collect 75 Foundation Credits.',
    effect: { type: 'collect', amount: 75 },
  },
  {
    id: 'recoveredArtifact',
    deck: 'anomalousEvent',
    title: 'Recovered Artifact',
    text: 'Collect 200 Foundation Credits.',
    effect: { type: 'collect', amount: 200 },
  },
  {
    id: 'mandatoryOvertime',
    deck: 'anomalousEvent',
    title: 'Mandatory Overtime',
    text: 'Pay each other player 25 Foundation Credits.',
    effect: { type: 'payEachPlayer', amount: 25 },
  },
  {
    id: 'budgetShortfall',
    deck: 'anomalousEvent',
    title: 'Budget Shortfall',
    text: 'Pay 100 Foundation Credits.',
    effect: { type: 'pay', amount: 100 },
  },
  {
    id: 'emergencyTransport',
    deck: 'anomalousEvent',
    title: 'Emergency Transport',
    text: 'Advance to the nearest Maintenance Tunnel. If unowned, you may buy it. If owned, pay the owner double the usual toll.',
    effect: { type: 'moveToNearestTunnel' },
  },
  {
    id: 'anomalousSignalDetected',
    deck: 'anomalousEvent',
    title: 'Anomalous Signal Detected',
    text: 'Advance to the nearest utility. If unowned, you may buy it. If owned, roll the dice and pay the owner ten times the total.',
    effect: { type: 'moveToNearestUtility' },
  },
  {
    id: 'secondaryContainmentClearance',
    deck: 'anomalousEvent',
    title: 'Secondary Containment Clearance',
    text: 'This card may be kept until needed, or sold. Get Out of the Containment Chamber Free.',
    effect: { type: 'getOutOfJailFree' },
  },
  {
    id: 'foundationBlackBudget',
    deck: 'anomalousEvent',
    title: 'Foundation Black Budget',
    text: 'Pay 50 Foundation Credits.',
    effect: { type: 'pay', amount: 50 },
  },
  {
    id: 'facilityBlackout',
    deck: 'anomalousEvent',
    title: 'Facility Blackout',
    text: 'Make general repairs on all your Wings: 20 Credits per house, 80 Credits per hotel.',
    effect: { type: 'repairs', perHouse: 20, perHotel: 80 },
  },
  {
    id: 'recoveredGamersFuel',
    deck: 'anomalousEvent',
    title: 'Recovered from a Breach Site: SCP-207',
    text: 'This may be kept until needed, or sold. A bottle of "Gamer\'s Fuel" - drink it for a burst of speed, at a cost.',
    effect: { type: 'objectAnomaly', objectId: 'gamersFuel' },
  },
  {
    id: 'recoveredBadComposition',
    deck: 'anomalousEvent',
    title: 'Recovered from a Breach Site: SCP-012',
    text: 'This may be kept until needed, or sold. An unfinished musical score - studying it is usually harmless. Usually.',
    effect: { type: 'objectAnomaly', objectId: 'badComposition' },
  },
];

export const FOUNDATION_DIRECTIVE_CARDS: CardDefinition[] = [
  {
    id: 'budgetSurplus',
    deck: 'foundationDirective',
    title: 'Budget Surplus',
    text: 'Collect 200 Foundation Credits.',
    effect: { type: 'collect', amount: 200 },
  },
  {
    id: 'fieldInjuryTreatment',
    deck: 'foundationDirective',
    title: 'Field Injury Treatment',
    text: 'Pay 50 Foundation Credits.',
    effect: { type: 'pay', amount: 50 },
  },
  {
    id: 'stockDividend',
    deck: 'foundationDirective',
    title: 'Stock Dividend',
    text: 'From a Foundation front-company sale, collect 50 Credits.',
    effect: { type: 'collect', amount: 50 },
  },
  {
    id: 'clearanceRevokedDirective',
    deck: 'foundationDirective',
    title: 'Clearance Revoked',
    text: 'This card may be kept until needed, or sold. Get Out of the Containment Chamber Free.',
    effect: { type: 'getOutOfJailFree' },
  },
  {
    id: 'reassignedToContainmentDuty',
    deck: 'foundationDirective',
    title: 'Reassigned to Containment Duty',
    text: 'Go directly to the Containment Chamber. Do not pass the Site Entrance, do not collect 200 Credits.',
    effect: { type: 'goToJail' },
  },
  {
    id: 'foundersDayGala',
    deck: 'foundationDirective',
    title: "Founder's Day Gala",
    text: 'Collect 50 Foundation Credits from every other player.',
    effect: { type: 'collectFromEachPlayer', amount: 50 },
  },
  {
    id: 'pensionFundMatures',
    deck: 'foundationDirective',
    title: 'Pension Fund Matures',
    text: 'Collect 100 Foundation Credits.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    id: 'taxRefund',
    deck: 'foundationDirective',
    title: 'Tax Refund',
    text: 'Collect 20 Foundation Credits.',
    effect: { type: 'collect', amount: 20 },
  },
  {
    id: 'consultancyFee',
    deck: 'foundationDirective',
    title: 'Consultancy Fee',
    text: 'Receive 25 Foundation Credits.',
    effect: { type: 'collect', amount: 25 },
  },
  {
    id: 'facilityAssessmentLevy',
    deck: 'foundationDirective',
    title: 'Facility Assessment Levy',
    text: 'You are assessed for facility repairs: 40 Credits per house, 115 Credits per hotel.',
    effect: { type: 'repairs', perHouse: 40, perHotel: 115 },
  },
  {
    id: 'siteTalentShow',
    deck: 'foundationDirective',
    title: 'Second Place, Site Talent Show',
    text: 'Collect 10 Foundation Credits.',
    effect: { type: 'collect', amount: 10 },
  },
  {
    id: 'colleagueInheritance',
    deck: 'foundationDirective',
    title: 'Inheritance from a Deceased Colleague',
    text: 'Collect 100 Foundation Credits.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    id: 'overpaymentRefund',
    deck: 'foundationDirective',
    title: 'Overpayment Refund',
    text: 'Collect 50 Foundation Credits.',
    effect: { type: 'collect', amount: 50 },
  },
  {
    id: 'auditFinding',
    deck: 'foundationDirective',
    title: 'Audit Finding',
    text: 'Pay 75 Foundation Credits.',
    effect: { type: 'pay', amount: 75 },
  },
  {
    id: 'retirementFundMatures',
    deck: 'foundationDirective',
    title: 'Retirement Fund Matures',
    text: 'Collect 150 Foundation Credits.',
    effect: { type: 'collect', amount: 150 },
  },
  {
    id: 'ethicsCommitteeSummons',
    deck: 'foundationDirective',
    title: 'Ethics Committee Summons',
    text: 'Collect 10 Foundation Credits from every other player.',
    effect: { type: 'collectFromEachPlayer', amount: 10 },
  },
  {
    id: 'workplaceInjuryClaim',
    deck: 'foundationDirective',
    title: 'Workplace Injury Claim',
    text: 'Pay 60 Foundation Credits.',
    effect: { type: 'pay', amount: 60 },
  },
  {
    id: 'siteAnniversaryBonus',
    deck: 'foundationDirective',
    title: 'Site Anniversary Bonus',
    text: 'Collect 30 Foundation Credits.',
    effect: { type: 'collect', amount: 30 },
  },
  {
    id: 'equipmentRequisitionFee',
    deck: 'foundationDirective',
    title: 'Equipment Requisition Fee',
    text: 'Pay 40 Foundation Credits.',
    effect: { type: 'pay', amount: 40 },
  },
  {
    id: 'secondaryClearanceCard',
    deck: 'foundationDirective',
    title: 'Secondary Clearance Card',
    text: 'This card may be kept until needed, or sold. Get Out of the Containment Chamber Free.',
    effect: { type: 'getOutOfJailFree' },
  },
  {
    id: 'complianceViolation',
    deck: 'foundationDirective',
    title: 'Compliance Violation',
    text: 'Go directly to the Containment Chamber. Do not pass the Site Entrance, do not collect 200 Credits.',
    effect: { type: 'goToJail' },
  },
  {
    id: 'costOfLivingAdjustment',
    deck: 'foundationDirective',
    title: 'Cost of Living Adjustment',
    text: 'Collect 20 Foundation Credits.',
    effect: { type: 'collect', amount: 20 },
  },
  {
    id: 'overdueExpenseReport',
    deck: 'foundationDirective',
    title: 'Overdue Expense Report',
    text: 'Pay 30 Foundation Credits.',
    effect: { type: 'pay', amount: 30 },
  },
  {
    id: 'cafeteriaFundSurplus',
    deck: 'foundationDirective',
    title: 'Cafeteria Fund Surplus',
    text: 'Collect 5 Foundation Credits from every other player.',
    effect: { type: 'collectFromEachPlayer', amount: 5 },
  },
  {
    id: 'requisitionedCountermeasure',
    deck: 'foundationDirective',
    title: 'Requisitioned from Site Storage: SCP-963',
    text: 'This may be kept until needed, or sold. An amber ring - worn, it carries you elsewhere the instant an anomaly would otherwise catch you.',
    effect: { type: 'objectAnomaly', objectId: 'countermeasure' },
  },
];

export const ALL_CARDS: CardDefinition[] = [...ANOMALOUS_EVENT_CARDS, ...FOUNDATION_DIRECTIVE_CARDS];

export function findCard(cardId: string): CardDefinition {
  const card = ALL_CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`Unknown card id: ${cardId}`);
  return card;
}
