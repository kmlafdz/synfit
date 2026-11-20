// Angle thresholds & constants for AI Form Coach

export const THRESHOLDS = {
  SQUAT: {
    STANDING_KNEE_MIN: 155, // degrees - standing up
    DESCENDING_TRIGGER: 145,
    BOTTOM_OPTIMAL_MAX: 95, // <= 95 deg is full depth
    BOTTOM_ACCEPTABLE_MAX: 110, // 95 - 110 is acceptable
    SHALLOW_WARNING_MIN: 115,
    MIN_REP_TIME_MS: 1200, // at least 1.2s per rep
    MAX_REP_TIME_MS: 8000,
    DESCENT_MIN_TIME_MS: 500, // less than 500ms descent is rushing
    BACK_INCLINE_MAX: 50, // maximum forward torso lean
  },

  PUSH_UP: {
    TOP_ELBOW_MIN: 155, // near lockout at top
    BOTTOM_ELBOW_MAX: 90, // <= 90 deg is full chest depth
    BOTTOM_ACCEPTABLE_MAX: 105,
    BODY_ALIGNMENT_MIN: 150, // shoulder-hip-ankle line straightness
    MIN_REP_TIME_MS: 1100,
    MAX_REP_TIME_MS: 7000,
  },

  BICEP_CURL: {
    EXTENDED_ELBOW_MIN: 145, // arm nearly straight
    CONTRACTED_ELBOW_MAX: 55, // arm fully curled
    CONTRACTED_ACCEPTABLE_MAX: 70,
    SHOULDER_DRIFT_MAX: 0.12, // normalized distance elbow travels forward
    MIN_REP_TIME_MS: 1000,
    MAX_REP_TIME_MS: 6000,
  },

  // Scoring weights
  FORM_SCORE: {
    EXCELLENT_MIN: 90,
    GOOD_MIN: 75,
    NEEDS_IMPROVEMENT_MIN: 60,
  },

  CAMERA: {
    MIN_VISIBILITY: 0.35,
    TOO_CLOSE_HEIGHT_RATIO: 0.88, // if head to ankle spans > 88% of screen
    TOO_FAR_HEIGHT_RATIO: 0.35, // if head to ankle spans < 35% of screen
  }
};
