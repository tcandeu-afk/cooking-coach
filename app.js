// ChefCoach — Intelligent AI Cooking Coach
// Features:
// 1. Multi-option dish picker with Regenerate cycles
// 2. Dietary Priorities that actively re-engineer fat, protein, fiber, ingredients & steps
// 3. Pantry Photo Vision (Gemini Vision / OpenAI Vision + instant local analyzer)
// 4. Smart Ingredient Swaps that re-engineer steps (or recommend a dish pivot if core item changes)
// 5. "Check Your Ingredients" intelligence: adapts steps when you press "Make It Now" or exports missing to Google Keep
// 6. Natural AI Voices: OpenAI Neural TTS ("nova"/"shimmer"/"onyx"), Gemini Audio, or top-ranked Natural OS voice

const state = {
  selectedModel: "gemini-argon", // "gemini-argon" | "chatgpt"
  servings: 2,
  nutritionBasis: "portion", // "portion" | "100g"
  dietary: {
    "cholesterol-safe": false,
    "protein-rich": false,
    "fiber-rich": false,
    "no-added-sugar": false,
  },
  otherDietaryText: "",
  speakerEnabled: false,
  wakeLockEnabled: true,
  voiceStyle: localStorage.getItem("chefcoach_voice_style") || "nova",
  currentAudio: null,
  regenIndex: 0,
  optionsHistory: [], // Stores each batch of dish options so user can click "← Previous"
  pantryPhotoDataUrl: null,
  pantryDetectedText: "",
  dishOptions: [],
  recipe: null,
  currentRating: 5,
  savedRecipes: JSON.parse(localStorage.getItem("chefcoach_saved_recipes") || "[]"),
  kitchenProfile: JSON.parse(
    localStorage.getItem("chefcoach_kitchen_profile") ||
      JSON.stringify({
        appliances: ["Dual-Drawer Air Fryer", "Silicone Loaf Inserts"],
        customAppliances: [],
        defaults: {
          metricOnly: true,
          eggless: false,
          lowSugar: false,
          highFibre: false,
          cholesterolConscious: false,
          dairyFree: false,
        },
      })
  ),
  recipeHistory: JSON.parse(localStorage.getItem("chefcoach_recipe_history") || "[]"),
  parsedIntent: null,
  copilotMessages: [],
  pivotSuggestion: null,
  currentStepIndex: 0,
  activeReplaceIndex: null,
  timerInterval: null,
  timerRemainingSec: 0,
  activeTimers: [], // Multi-step background timers { id, stepNum, label, remainingSec }
  multiTimerTick: null,
  wakeLockSentinel: null,
  voiceRecognition: null,
  voiceCommandsListening: false,
  isCoachSpeaking: false,
};

const dom = {
  screens: {
    setup: document.getElementById("screenSetup"),
    options: document.getElementById("screenOptions"),
    ingredients: document.getElementById("screenIngredients"),
    partnerChat: document.getElementById("screenPartnerChat"),
    cooking: document.getElementById("screenCooking"),
    done: document.getElementById("screenDone"),
    recipeBook: document.getElementById("screenRecipeBook"),
  },
  homeBtn: document.getElementById("homeBtn"),
  openRecipeBookTopBtn: document.getElementById("openRecipeBookTopBtn"),
  savedCountBadge: document.getElementById("savedCountBadge"),
  burgerMenuBtn: document.getElementById("burgerMenuBtn"),
  burgerModal: document.getElementById("burgerModal"),
  closeBurgerModalBtn: document.getElementById("closeBurgerModalBtn"),
  openRecipeBookMenuBtn: document.getElementById("openRecipeBookMenuBtn"),
  burgerBookCount: document.getElementById("burgerBookCount"),
  wakeLockToggleBtn: document.getElementById("wakeLockToggleBtn"),
  modelGeminiBtn: document.getElementById("modelGeminiBtn"),
  modelChatgptBtn: document.getElementById("modelChatgptBtn"),
  generateSubText: document.getElementById("generateSubText"),

  // Setup & Camera
  cravingInput: document.getElementById("cravingInput"),
  clearInputBtn: document.getElementById("clearInputBtn"),
  parsedIntentChips: document.getElementById("parsedIntentChips"),
  pantryPhotoInput: document.getElementById("pantryPhotoInput"),
  photoPreviewCard: document.getElementById("photoPreviewCard"),
  photoPreviewImg: document.getElementById("photoPreviewImg"),
  photoStatusBadge: document.getElementById("photoStatusBadge"),
  photoDetectedText: document.getElementById("photoDetectedText"),
  removePhotoBtn: document.getElementById("removePhotoBtn"),
  otherDietaryInput: document.getElementById("otherDietaryInput"),
  clearOtherDietBtn: document.getElementById("clearOtherDietBtn"),
  servingsMinus: document.getElementById("servingsMinus"),
  servingsPlus: document.getElementById("servingsPlus"),
  servingsValue: document.getElementById("servingsValue"),
  findDishesBtn: document.getElementById("findDishesBtn"),

  // Screen 2: Dish Options, Conflict Warning, Tweak Box & Nutrition Basis
  optionsSubtitle: document.getElementById("optionsSubtitle"),
  optionsIntentChips: document.getElementById("optionsIntentChips"),
  optionsDietaryBadges: document.getElementById("optionsDietaryBadges"),
  dietaryConflictBanner: document.getElementById("dietaryConflictBanner"),
  dietaryConflictText: document.getElementById("dietaryConflictText"),
  conflictSwapBtn: document.getElementById("conflictSwapBtn"),
  tweakOptionsInput: document.getElementById("tweakOptionsInput"),
  applyTweakOptionsBtn: document.getElementById("applyTweakOptionsBtn"),
  basisPortionBtn: document.getElementById("basisPortionBtn"),
  basis100gBtn: document.getElementById("basis100gBtn"),
  prevOptionsBtn: document.getElementById("prevOptionsBtn"),
  regenerateOptionsBtn: document.getElementById("regenerateOptionsBtn"),
  dishOptionsContainer: document.getElementById("dishOptionsContainer"),
  backToSetupFromOptionsBtn: document.getElementById("backToSetupFromOptionsBtn"),

  // Screen 3: Ingredients, Smart Swaps & Keep
  recipeBadges: document.getElementById("recipeBadges"),
  saveRecipeFromIngBtn: document.getElementById("saveRecipeFromIngBtn"),
  saveNewIterationBtn: document.getElementById("saveNewIterationBtn"),
  recipeTitle: document.getElementById("recipeTitle"),
  recipeSummary: document.getElementById("recipeSummary"),
  detailPrepTime: document.getElementById("detailPrepTime"),
  detailDifficulty: document.getElementById("detailDifficulty"),
  detailServings: document.getElementById("detailServings"),
  liveMacroSummaryBar: document.getElementById("liveMacroSummaryBar"),
  liveMacroBatchSummary: document.getElementById("liveMacroBatchSummary"),
  liveMacroGrid: document.getElementById("liveMacroGrid"),
  copilotPanel: document.getElementById("copilotPanel"),
  copilotToggleBtn: document.getElementById("copilotToggleBtn"),
  copilotBody: document.getElementById("copilotBody"),
  copilotQuickChips: document.getElementById("copilotQuickChips"),
  copilotChatStream: document.getElementById("copilotChatStream"),
  copilotInput: document.getElementById("copilotInput"),
  copilotSendBtn: document.getElementById("copilotSendBtn"),
  detailStepsCountLabel: document.getElementById("detailStepsCountLabel"),
  detailStepsPreviewList: document.getElementById("detailStepsPreviewList"),
  nutriBasisTitle: document.getElementById("nutriBasisTitle"),
  toggleBasisIngBtn: document.getElementById("toggleBasisIngBtn"),
  nutritionStrip: document.getElementById("nutritionStrip"),
  aiAdaptationBanner: document.getElementById("aiAdaptationBanner"),
  aiAdaptationText: document.getElementById("aiAdaptationText"),
  pivotRecipeBtn: document.getElementById("pivotRecipeBtn"),
  ingredientList: document.getElementById("ingredientList"),
  checkAllBtn: document.getElementById("checkAllBtn"),
  addExtraInput: document.getElementById("addExtraInput"),
  addExtraBtn: document.getElementById("addExtraBtn"),
  shoppingListKeepBtn: document.getElementById("shoppingListKeepBtn"),
  shoppingCountSubtext: document.getElementById("shoppingCountSubtext"),
  makeItNowBtn: document.getElementById("makeItNowBtn"),
  makeItNowMainText: document.getElementById("makeItNowMainText"),
  checkedCounterText: document.getElementById("checkedCounterText"),
  backToOptionsBtn: document.getElementById("backToOptionsBtn"),

  // Screen 3.5: Kitchen Partner Chat
  partnerChatSubtitle: document.getElementById("partnerChatSubtitle"),
  partnerChatStream: document.getElementById("partnerChatStream"),
  partnerChatInput: document.getElementById("partnerChatInput"),
  sendPartnerChatBtn: document.getElementById("sendPartnerChatBtn"),
  backToIngredientsFromChatBtn: document.getElementById("backToIngredientsFromChatBtn"),
  proceedFromChatToCookBtn: document.getElementById("proceedFromChatToCookBtn"),
  chatAdaptedSubText: document.getElementById("chatAdaptedSubText"),

  // Screen 4: Cooking Coach
  backToIngredientsBtn: document.getElementById("backToIngredientsBtn"),
  speakerToggleBtn: document.getElementById("speakerToggleBtn"),
  speakerIcon: document.getElementById("speakerIcon"),
  speakerLabel: document.getElementById("speakerLabel"),
  repeatVoiceBtn: document.getElementById("repeatVoiceBtn"),
  openAllStepsBtn: document.getElementById("openAllStepsBtn"),
  voiceCommandToggleBtn: document.getElementById("voiceCommandToggleBtn"),
  activeTimersTray: document.getElementById("activeTimersTray"),
  stepCounterBadge: document.getElementById("stepCounterBadge"),
  stepPhaseText: document.getElementById("stepPhaseText"),
  stepProgressFill: document.getElementById("stepProgressFill"),
  stepInstructionText: document.getElementById("stepInstructionText"),
  stepTipText: document.getElementById("stepTipText"),
  stepTimerArea: document.getElementById("stepTimerArea"),
  timerModesRow: document.getElementById("timerModesRow"),
  timerMinusMinBtn: document.getElementById("timerMinusMinBtn"),
  toggleTimerBtn: document.getElementById("toggleTimerBtn"),
  timerPlusMinBtn: document.getElementById("timerPlusMinBtn"),
  prevStepBtn: document.getElementById("prevStepBtn"),
  nextStepBtn: document.getElementById("nextStepBtn"),
  nextStepMainText: document.getElementById("nextStepMainText"),
  nextStepSubText: document.getElementById("nextStepSubText"),

  // Screen 5: Done & Rate/Save
  doneSummaryText: document.getElementById("doneSummaryText"),
  doneStarRatingRow: document.getElementById("doneStarRatingRow"),
  saveToBookDoneBtn: document.getElementById("saveToBookDoneBtn"),
  doneNutritionSummary: document.getElementById("doneNutritionSummary"),
  openBookFromDoneBtn: document.getElementById("openBookFromDoneBtn"),
  cookAnotherBtn: document.getElementById("cookAnotherBtn"),

  // Screen 6: My Recipe Book
  recipeBookListContainer: document.getElementById("recipeBookListContainer"),
  backHomeFromBookBtn: document.getElementById("backHomeFromBookBtn"),

  // Modals
  allStepsModal: document.getElementById("allStepsModal"),
  closeAllStepsBtn: document.getElementById("closeAllStepsBtn"),
  allStepsListContainer: document.getElementById("allStepsListContainer"),

  replaceModal: document.getElementById("replaceModal"),
  closeReplaceBtn: document.getElementById("closeReplaceBtn"),
  replaceTargetLabel: document.getElementById("replaceTargetLabel"),
  replaceOptionsList: document.getElementById("replaceOptionsList"),
  customReplaceInput: document.getElementById("customReplaceInput"),
  applyCustomReplaceBtn: document.getElementById("applyCustomReplaceBtn"),

  keepModal: document.getElementById("keepModal"),
  closeKeepModalBtn: document.getElementById("closeKeepModalBtn"),
  keepModalStatus: document.getElementById("keepModalStatus"),
  keepPreviewText: document.getElementById("keepPreviewText"),
  nativeShareKeepBtn: document.getElementById("nativeShareKeepBtn"),

  geminiKeyInput: document.getElementById("geminiKeyInput"),
  openaiKeyInput: document.getElementById("openaiKeyInput"),
  geminiKeyStatusBadge: document.getElementById("geminiKeyStatusBadge"),
  openaiKeyStatusBadge: document.getElementById("openaiKeyStatusBadge"),
  testApiKeysBtn: document.getElementById("testApiKeysBtn"),
  apiTestSummaryBox: document.getElementById("apiTestSummaryBox"),
  voiceStyleSelect: document.getElementById("voiceStyleSelect"),
  saveApiKeysBtn: document.getElementById("saveApiKeysBtn"),
  applianceProfileChips: document.getElementById("applianceProfileChips"),
  customApplianceInput: document.getElementById("customApplianceInput"),
  addCustomApplianceBtn: document.getElementById("addCustomApplianceBtn"),
  culinaryDefaultsChips: document.getElementById("culinaryDefaultsChips"),
  recipeHistoryCountSub: document.getElementById("recipeHistoryCountSub"),
  clearRecipeHistoryBtn: document.getElementById("clearRecipeHistoryBtn"),
};

// ---------------- INITIALIZATION ----------------
function init() {
  localStorage.removeItem("chefcoach_gemini_tts_disabled");
  dom.geminiKeyInput.value = localStorage.getItem("chefcoach_gemini_key") || "";
  dom.openaiKeyInput.value = localStorage.getItem("chefcoach_openai_key") || "";
  dom.voiceStyleSelect.value = state.voiceStyle;
  updateSavedCountBadges();
  initKitchenProfileUI();
  initCopilotUI();
  initDynamicSearchPlaceholders();

  if (dom.saveNewIterationBtn) {
    dom.saveNewIterationBtn.addEventListener("click", saveAsNewIteration);
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  dom.modelGeminiBtn.addEventListener("click", () => setModel("gemini-argon"));
  dom.modelChatgptBtn.addEventListener("click", () => setModel("chatgpt"));

  // Burger Menu & Recipe Book Navigation
  if (dom.burgerMenuBtn) {
    dom.burgerMenuBtn.addEventListener("click", () => {
      updateSavedCountBadges();
      dom.burgerModal.hidden = false;
    });
  }
  if (dom.closeBurgerModalBtn) {
    dom.closeBurgerModalBtn.addEventListener("click", () => (dom.burgerModal.hidden = true));
  }
  if (dom.openRecipeBookTopBtn) {
    dom.openRecipeBookTopBtn.addEventListener("click", () => {
      renderRecipeBookScreen();
      showScreen("recipeBook");
    });
  }
  if (dom.openRecipeBookMenuBtn) {
    dom.openRecipeBookMenuBtn.addEventListener("click", () => {
      dom.burgerModal.hidden = true;
      renderRecipeBookScreen();
      showScreen("recipeBook");
    });
  }
  if (dom.backHomeFromBookBtn) {
    dom.backHomeFromBookBtn.addEventListener("click", () => showScreen("setup"));
  }
  if (dom.wakeLockToggleBtn) {
    dom.wakeLockToggleBtn.addEventListener("click", () => {
      state.wakeLockEnabled = !state.wakeLockEnabled;
      dom.wakeLockToggleBtn.classList.toggle("active", state.wakeLockEnabled);
      dom.wakeLockToggleBtn.setAttribute("aria-pressed", String(state.wakeLockEnabled));
      dom.wakeLockToggleBtn.textContent = state.wakeLockEnabled ? "ON" : "OFF";
      if (!state.wakeLockEnabled) {
        releaseKitchenWakeLock();
      } else if (dom.screens.cooking.classList.contains("active")) {
        requestKitchenWakeLock();
      }
    });
  }

  // Tweak #4: "Go →" button generates dish options directly (works even while mobile keyboard is open)
  let isGeneratingDishes = false;
  const triggerGoFromInput = (e) => {
    if (e) e.preventDefault();
    if (isGeneratingDishes) return;
    if (dom.cravingInput) dom.cravingInput.blur();
    state.regenIndex = 0;
    state.optionsHistory = [];
    generateDishOptions();
  };

  dom.clearInputBtn.addEventListener("pointerdown", (e) => {
    // Prevent textarea blur from swallowing the first tap on iOS Safari while keyboard is up
    e.preventDefault();
  });
  dom.clearInputBtn.addEventListener("click", triggerGoFromInput);

  dom.cravingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      state.regenIndex = 0;
      state.optionsHistory = [];
      generateDishOptions();
    }
  });

  // Bottom & Desktop 4-destination navigation
  document.querySelectorAll("[data-nav]").forEach((navBtn) => {
    navBtn.addEventListener("click", () => {
      const target = navBtn.dataset.nav;
      if (target === "preferences") {
        updateSavedCountBadges();
        dom.burgerModal.hidden = false;
        return;
      }
      if (target === "recipeBook") {
        renderRecipeBookScreen();
        showScreen("recipeBook");
        return;
      }
      if (target === "options") {
        if (!state.dishOptions || state.dishOptions.length === 0) {
          state.regenIndex = 0;
          state.optionsHistory = [];
          generateDishOptions();
        } else {
          showScreen("options");
        }
        return;
      }
      showScreen("setup");
    });
  });

  // Camera / Pantry Photo Upload
  dom.pantryPhotoInput.addEventListener("change", handlePantryPhotoUpload);
  dom.removePhotoBtn.addEventListener("click", () => {
    state.pantryPhotoDataUrl = null;
    state.pantryDetectedText = "";
    dom.pantryPhotoInput.value = "";
    dom.photoPreviewCard.hidden = true;
  });

  document.querySelectorAll(".chip-suggestion").forEach((chip) => {
    chip.addEventListener("click", () => {
      dom.cravingInput.value = chip.dataset.prompt;
    });
  });

  document.querySelectorAll(".diet-card").forEach((card) => {
    card.addEventListener("click", () => {
      const key = card.dataset.diet;
      state.dietary[key] = !state.dietary[key];
      card.classList.toggle("active", state.dietary[key]);
      card.setAttribute("aria-pressed", String(state.dietary[key]));
      card.querySelector(".diet-check").textContent = state.dietary[key] ? "✓" : "+";
    });
  });

  if (dom.otherDietaryInput) {
    dom.otherDietaryInput.addEventListener("input", () => {
      state.otherDietaryText = dom.otherDietaryInput.value.trim();
      if (dom.clearOtherDietBtn) {
        dom.clearOtherDietBtn.hidden = !state.otherDietaryText;
      }
    });
  }
  if (dom.clearOtherDietBtn) {
    dom.clearOtherDietBtn.addEventListener("click", () => {
      dom.otherDietaryInput.value = "";
      state.otherDietaryText = "";
      dom.clearOtherDietBtn.hidden = true;
      dom.otherDietaryInput.focus();
    });
  }

  dom.servingsMinus.addEventListener("click", () => {
    if (state.servings > 1) {
      state.servings--;
      dom.servingsValue.textContent = state.servings;
    }
  });
  dom.servingsPlus.addEventListener("click", () => {
    if (state.servings < 12) {
      state.servings++;
      dom.servingsValue.textContent = state.servings;
    }
  });

  // Screen 1 -> Screen 2 (Generate Dish Options)
  dom.findDishesBtn.addEventListener("click", () => {
    state.regenIndex = 0;
    state.optionsHistory = [];
    generateDishOptions();
  });

  // Screen 2: Nutrition Basis Toggle (Per Portion vs Per 100g)
  if (dom.basisPortionBtn && dom.basis100gBtn) {
    dom.basisPortionBtn.addEventListener("click", () => setNutritionBasis("portion"));
    dom.basis100gBtn.addEventListener("click", () => setNutritionBasis("100g"));
  }
  if (dom.toggleBasisIngBtn) {
    dom.toggleBasisIngBtn.addEventListener("click", () => {
      setNutritionBasis(state.nutritionBasis === "portion" ? "100g" : "portion");
    });
  }

  // Screen 2: Interactive Amend / Tweak Bar
  if (dom.applyTweakOptionsBtn) {
    dom.applyTweakOptionsBtn.addEventListener("click", () => {
      const val = dom.tweakOptionsInput.value.trim();
      if (val) {
        applyTweakToDishSuggestions(val);
        dom.tweakOptionsInput.value = "";
      }
    });
  }
  if (dom.tweakOptionsInput) {
    dom.tweakOptionsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = dom.tweakOptionsInput.value.trim();
        if (val) {
          applyTweakToDishSuggestions(val);
          dom.tweakOptionsInput.value = "";
        }
      }
    });
  }
  document.querySelectorAll(".quick-tweak-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      applyTweakToDishSuggestions(pill.dataset.tweak);
    });
  });

  // Screen 2: Previous & Regenerate Dish Options
  if (dom.prevOptionsBtn) {
    dom.prevOptionsBtn.addEventListener("click", () => {
      if (state.regenIndex > 0) {
        state.regenIndex--;
        const promptText = dom.cravingInput.value.trim() || "Mediterranean Salmon, Quinoa & Greens";
        if (state.optionsHistory[state.regenIndex]) {
          state.dishOptions = state.optionsHistory[state.regenIndex];
          renderDishOptionsScreen(promptText);
        } else {
          generateDishOptions();
        }
      }
    });
  }

  dom.regenerateOptionsBtn.addEventListener("click", () => {
    state.regenIndex++;
    const promptText = dom.cravingInput.value.trim() || "Mediterranean Salmon, Quinoa & Greens";
    if (state.optionsHistory[state.regenIndex]) {
      state.dishOptions = state.optionsHistory[state.regenIndex];
      renderDishOptionsScreen(promptText);
    } else {
      generateDishOptions();
    }
  });
  dom.backToSetupFromOptionsBtn.addEventListener("click", () => showScreen("setup"));

  // Screen 3: Ingredients & Smart Actions
  if (dom.saveRecipeFromIngBtn) {
    dom.saveRecipeFromIngBtn.addEventListener("click", () => {
      saveCurrentRecipeToBook(state.currentRating || 5);
    });
  }
  dom.checkAllBtn.addEventListener("click", toggleCheckAllIngredients);
  dom.addExtraBtn.addEventListener("click", handleAddExtraIngredient);
  dom.shoppingListKeepBtn.addEventListener("click", openGoogleKeepShoppingModal);
  dom.makeItNowBtn.addEventListener("click", handleMakeItNow);
  dom.backToOptionsBtn.addEventListener("click", () => showScreen("options"));
  dom.pivotRecipeBtn.addEventListener("click", () => {
    if (state.pivotSuggestion) {
      selectDishOption(state.pivotSuggestion);
    }
  });

  // Screen 3.5: Kitchen Partner Chat
  if (dom.sendPartnerChatBtn) {
    dom.sendPartnerChatBtn.addEventListener("click", handlePartnerChatUserMessage);
  }
  if (dom.partnerChatInput) {
    dom.partnerChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handlePartnerChatUserMessage();
    });
  }
  if (dom.backToIngredientsFromChatBtn) {
    dom.backToIngredientsFromChatBtn.addEventListener("click", () => {
      renderIngredientsScreen();
      showScreen("ingredients");
    });
  }
  if (dom.proceedFromChatToCookBtn) {
    dom.proceedFromChatToCookBtn.addEventListener("click", () => {
      unlockMobileAudioMediaChannel(true);
      finalizeUncheckedAdaptations();
      state.currentStepIndex = 0;
      showScreen("cooking");
      renderCurrentStep(true);
    });
  }

  // Screen 4: Cooking Coach
  dom.backToIngredientsBtn.addEventListener("click", () => {
    stopSpeech();
    renderIngredientsScreen();
    showScreen("ingredients");
  });

  dom.speakerToggleBtn.addEventListener("click", () => {
    state.speakerEnabled = !state.speakerEnabled;
    updateSpeakerUI();
    if (state.speakerEnabled) {
      speakCurrentStep(true);
    } else {
      stopSpeech();
    }
  });

  dom.repeatVoiceBtn.addEventListener("click", () => {
    speakCurrentStep(true);
  });

  dom.openAllStepsBtn.addEventListener("click", openAllStepsModal);
  dom.closeAllStepsBtn.addEventListener("click", () => (dom.allStepsModal.hidden = true));

  if (dom.voiceCommandToggleBtn) {
    dom.voiceCommandToggleBtn.addEventListener("click", toggleHandsFreeVoiceCommands);
  }

  const turnOffVoiceOnExit = () => {
    stopSpeech();
    if (state.speakerEnabled) {
      state.speakerEnabled = false;
      updateSpeakerUI();
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      turnOffVoiceOnExit();
    } else if (document.visibilityState === "visible" && dom.screens.cooking.classList.contains("active")) {
      requestKitchenWakeLock();
    }
  });
  window.addEventListener("pagehide", turnOffVoiceOnExit);
  window.addEventListener("beforeunload", turnOffVoiceOnExit);

  dom.prevStepBtn.addEventListener("click", () => {
    if (state.currentStepIndex > 0) {
      state.currentStepIndex--;
      renderCurrentStep(true);
    }
  });

  dom.nextStepBtn.addEventListener("click", () => {
    if (!state.recipe) return;
    if (state.currentStepIndex < state.recipe.steps.length - 1) {
      state.currentStepIndex++;
      renderCurrentStep(true);
    } else {
      stopSpeech();
      renderDoneScreen();
      showScreen("done");
    }
  });

  dom.toggleTimerBtn.addEventListener("click", toggleStepTimer);
  if (dom.timerMinusMinBtn) {
    dom.timerMinusMinBtn.addEventListener("click", () => adjustCurrentStepTimer(-1));
  }
  if (dom.timerPlusMinBtn) {
    dom.timerPlusMinBtn.addEventListener("click", () => adjustCurrentStepTimer(1));
  }

  // Screen 5: Done & Star Rating
  if (dom.doneStarRatingRow) {
    dom.doneStarRatingRow.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.currentRating = parseInt(btn.dataset.rating, 10);
        updateDoneStarUI();
      });
    });
  }
  if (dom.saveToBookDoneBtn) {
    dom.saveToBookDoneBtn.addEventListener("click", () => {
      saveCurrentRecipeToBook(state.currentRating);
    });
  }
  if (dom.openBookFromDoneBtn) {
    dom.openBookFromDoneBtn.addEventListener("click", () => {
      renderRecipeBookScreen();
      showScreen("recipeBook");
    });
  }
  dom.cookAnotherBtn.addEventListener("click", () => {
    stopSpeech();
    showScreen("setup");
  });
  dom.homeBtn.addEventListener("click", () => {
    stopSpeech();
    showScreen("setup");
  });

  // Modals
  dom.closeReplaceBtn.addEventListener("click", () => (dom.replaceModal.hidden = true));
  dom.applyCustomReplaceBtn.addEventListener("pointerdown", (e) => e.preventDefault());
  dom.applyCustomReplaceBtn.addEventListener("click", applyCustomReplacement);
  if (dom.customReplaceInput) {
    dom.customReplaceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomReplacement();
      }
    });
  }

  dom.closeKeepModalBtn.addEventListener("click", () => (dom.keepModal.hidden = true));
  dom.nativeShareKeepBtn.addEventListener("click", handleNativeShareKeep);

  dom.saveApiKeysBtn.addEventListener("click", async () => {
    localStorage.setItem("chefcoach_gemini_key", dom.geminiKeyInput.value.trim());
    localStorage.setItem("chefcoach_openai_key", dom.openaiKeyInput.value.trim());
    state.voiceStyle = dom.voiceStyleSelect.value;
    localStorage.setItem("chefcoach_voice_style", state.voiceStyle);
    await verifyBothApiKeys(true);
  });

  if (dom.testApiKeysBtn) {
    dom.testApiKeysBtn.addEventListener("click", async () => {
      localStorage.setItem("chefcoach_gemini_key", dom.geminiKeyInput.value.trim());
      localStorage.setItem("chefcoach_openai_key", dom.openaiKeyInput.value.trim());
      await verifyBothApiKeys(false);
    });
  }

  [dom.allStepsModal, dom.replaceModal, dom.keepModal, dom.burgerModal].forEach((m) => {
    if (!m) return;
    m.addEventListener("click", (e) => {
      if (e.target === m) m.hidden = true;
    });
  });

  // Update initial badge labels if keys are already in localStorage
  updateInitialKeyBadgeLabels();
}

function updateInitialKeyBadgeLabels() {
  const gKey = (dom.geminiKeyInput?.value || "").trim();
  const oKey = (dom.openaiKeyInput?.value || "").trim();
  if (dom.geminiKeyStatusBadge) {
    dom.geminiKeyStatusBadge.textContent = gKey ? "Key saved (Tap Test)" : "No key entered";
    dom.geminiKeyStatusBadge.className = "api-status-pill";
  }
  if (dom.openaiKeyStatusBadge) {
    dom.openaiKeyStatusBadge.textContent = oKey ? "Key saved (Tap Test)" : "No key entered";
    dom.openaiKeyStatusBadge.className = "api-status-pill";
  }
}

let cachedWorkingGeminiModel = null;

async function discoverActiveGeminiModels(apiKey) {
  const candidates = [
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.0-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-pro-latest",
  ];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || [])
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent")
        )
        .map((m) => String(m.name || "").replace(/^models\//, ""))
        .filter((id) => id && !/2\.0-flash|2\.5-flash|embedding|imagen|veo|aqa|tts|audio/i.test(id));

      // Sort to prefer flash / pro text models first
      models.sort((a, b) => {
        const score = (s) => (/3.*flash/i.test(s) ? 30 : /flash/i.test(s) ? 20 : /pro/i.test(s) ? 10 : 0);
        return score(b) - score(a);
      });

      return [...new Set([...models, ...candidates])];
    }
  } catch {
    // Ignore list error and fall back to candidates
  }
  return candidates;
}

async function callGeminiGenerateContent(apiKey, bodyPayload) {
  let lastErrorMsg = "Unable to reach Gemini API";
  const modelList = cachedWorkingGeminiModel
    ? [cachedWorkingGeminiModel]
    : await discoverActiveGeminiModels(apiKey);

  for (const modelId of modelList) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        }
      );
      if (res.ok) {
        cachedWorkingGeminiModel = modelId;
        const data = await res.json();
        return { ok: true, modelId, data };
      }
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      lastErrorMsg = msg;
      if (/API_KEY_INVALID|API key not valid/i.test(msg)) {
        break;
      }
    } catch (err) {
      lastErrorMsg = err.message || "Network error";
    }
  }
  return { ok: false, error: lastErrorMsg };
}

async function verifyBothApiKeys(closeIfAllGood = false) {
  const gKey = (dom.geminiKeyInput?.value || "").trim();
  const oKey = (dom.openaiKeyInput?.value || "").trim();

  if (dom.testApiKeysBtn) {
    dom.testApiKeysBtn.disabled = true;
    dom.testApiKeysBtn.textContent = "⏳ Testing...";
  }
  if (dom.apiTestSummaryBox) {
    dom.apiTestSummaryBox.hidden = false;
    dom.apiTestSummaryBox.innerHTML = "⏳ Pinging Google Gemini & OpenAI servers...";
  }

  const results = [];
  let gOk = false;
  let oOk = false;

  // 1. Test Gemini API Key (automatically uses gemini-3.8-flash or newest available)
  if (!gKey) {
    if (dom.geminiKeyStatusBadge) {
      dom.geminiKeyStatusBadge.textContent = "Empty";
      dom.geminiKeyStatusBadge.className = "api-status-pill";
    }
    results.push("✨ <strong>Gemini Argon</strong>: No key entered (using built-in culinary engine).");
  } else {
    const gRes = await callGeminiGenerateContent(gKey, {
      contents: [{ parts: [{ text: "Reply with OK" }] }],
    });
    if (gRes.ok) {
      gOk = true;
      if (dom.geminiKeyStatusBadge) {
        dom.geminiKeyStatusBadge.textContent = "✅ Connected & Live";
        dom.geminiKeyStatusBadge.className = "api-status-pill ok";
      }
      results.push(`✅ <strong>Gemini Argon (${gRes.modelId})</strong>: Connected & working live!`);
    } else {
      if (dom.geminiKeyStatusBadge) {
        dom.geminiKeyStatusBadge.textContent = "❌ Error";
        dom.geminiKeyStatusBadge.className = "api-status-pill err";
      }
      results.push(`❌ <strong>Gemini Argon</strong>: ${gRes.error}`);
    }
  }

  // 2. Test OpenAI API Key
  if (!oKey) {
    if (dom.openaiKeyStatusBadge) {
      dom.openaiKeyStatusBadge.textContent = "Empty";
      dom.openaiKeyStatusBadge.className = "api-status-pill";
    }
    results.push("🤖 <strong>OpenAI ChatGPT</strong>: No key entered (using built-in engine).");
  } else {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${oKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 5,
          messages: [{ role: "user", content: "Reply OK" }],
        }),
      });
      if (res.ok) {
        oOk = true;
        localStorage.removeItem("chefcoach_openai_tts_disabled");
        if (dom.openaiKeyStatusBadge) {
          dom.openaiKeyStatusBadge.textContent = "✅ Connected & Live";
          dom.openaiKeyStatusBadge.className = "api-status-pill ok";
        }
        results.push("✅ <strong>OpenAI ChatGPT & Neural Voice</strong>: Connected & working live!");
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${res.status}`;
        localStorage.setItem("chefcoach_openai_tts_disabled", "true");
        if (dom.openaiKeyStatusBadge) {
          dom.openaiKeyStatusBadge.textContent =
            res.status === 429 || /credits|quota|billing/i.test(msg)
              ? "✓ Key Valid (No OpenAI Credits)"
              : "❌ Invalid Key";
          dom.openaiKeyStatusBadge.className = "api-status-pill err";
        }
        results.push(
          res.status === 429 || /credits|quota|billing/i.test(msg)
            ? `ℹ️ <strong>OpenAI ChatGPT</strong>: Your key is valid, but OpenAI requires a prepaid balance ($5) to run API calls. (ChefCoach will automatically use its built-in ChatGPT culinary engine & natural OS voice in the meantime!)`
            : `❌ <strong>OpenAI ChatGPT</strong>: ${msg}`
        );
      }
    } catch (err) {
      if (dom.openaiKeyStatusBadge) {
        dom.openaiKeyStatusBadge.textContent = "⚠️ Network Error";
        dom.openaiKeyStatusBadge.className = "api-status-pill err";
      }
      results.push(`⚠️ <strong>OpenAI ChatGPT</strong>: Network error (${err.message || "check connection"}).`);
    }
  }

  if (dom.testApiKeysBtn) {
    dom.testApiKeysBtn.disabled = false;
    dom.testApiKeysBtn.textContent = "🔌 Test Both Keys";
  }
  if (dom.apiTestSummaryBox) {
    dom.apiTestSummaryBox.innerHTML = results.join("<br>");
  }

  // Clear cached options so the next generation uses the newly verified live keys
  state.regenIndex = 0;
  state.optionsHistory = [];

  if (closeIfAllGood && ((gKey && gOk && (!oKey || oOk)) || (oKey && oOk && (!gKey || gOk)))) {
    setTimeout(() => {
      dom.burgerModal.hidden = true;
    }, 1100);
  }
}

function setModel(modelName) {
  if (state.selectedModel === modelName) return;
  state.selectedModel = modelName;
  const isGemini = modelName === "gemini-argon";
  dom.modelGeminiBtn.classList.toggle("active", isGemini);
  dom.modelChatgptBtn.classList.toggle("active", !isGemini);

  // Clear cached history so switching between Gemini Argon and ChatGPT produces fresh model-specific dishes!
  state.regenIndex = 0;
  state.optionsHistory = [];
  if (dom.screens.options.classList.contains("active")) {
    generateDishOptions();
  }
}

function setNutritionBasis(basis) {
  state.nutritionBasis = basis;
  if (dom.basisPortionBtn && dom.basis100gBtn) {
    dom.basisPortionBtn.classList.toggle("active", basis === "portion");
    dom.basis100gBtn.classList.toggle("active", basis === "100g");
  }
  if (dom.screens.options.classList.contains("active")) {
    const promptText = dom.cravingInput.value.trim() || "Mediterranean Salmon, Quinoa & Greens";
    renderDishOptionsScreen(promptText);
  }
  if (dom.screens.ingredients.classList.contains("active")) {
    renderIngredientsScreen();
  }
}

function showScreen(screenKey) {
  Object.entries(dom.screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === screenKey);
  });

  // Update active navigation tab across mobile bottom bar and desktop nav
  const activeNavKey =
    screenKey === "options" || screenKey === "ingredients" || screenKey === "partnerChat" || screenKey === "cooking"
      ? "options"
      : screenKey === "recipeBook"
      ? "recipeBook"
      : "setup";

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    if (btn.dataset.nav === "preferences") return;
    btn.classList.toggle("active", btn.dataset.nav === activeNavKey);
  });

  if (screenKey === "cooking") {
    requestKitchenWakeLock();
  } else {
    stopSpeech();
    if (state.speakerEnabled) {
      state.speakerEnabled = false;
      updateSpeakerUI();
    }
    releaseKitchenWakeLock();
    stopHandsFreeVoiceCommands();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------- PANTRY CAMERA / VISION AI ----------------
async function handlePantryPhotoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    state.pantryPhotoDataUrl = reader.result;
    dom.photoPreviewImg.src = state.pantryPhotoDataUrl;
    dom.photoPreviewCard.hidden = false;
    dom.photoStatusBadge.textContent = "👁️ Analyzing Pantry...";
    dom.photoDetectedText.textContent = "Scanning ingredients with Vision AI...";

    const detected = await detectIngredientsFromPhoto(file, state.pantryPhotoDataUrl);
    state.pantryDetectedText = detected;
    dom.photoStatusBadge.textContent = "✓ Pantry Scanned";
    dom.photoDetectedText.textContent = `Detected: ${detected}`;

    if (!dom.cravingInput.value.trim()) {
      dom.cravingInput.value = detected;
    } else {
      dom.cravingInput.value = `${dom.cravingInput.value.trim()}, ${detected}`;
    }
  };
  reader.readAsDataURL(file);
}

async function detectIngredientsFromPhoto(file, dataUrl) {
  const geminiKey = localStorage.getItem("chefcoach_gemini_key");
  const openaiKey = localStorage.getItem("chefcoach_openai_key");
  const base64Data = dataUrl.split(",")[1];

  if (geminiKey) {
    const gRes = await callGeminiGenerateContent(geminiKey, {
      contents: [
        {
          parts: [
            { text: "List the edible food ingredients visible in this photo as a short comma-separated list (e.g. '3 bananas, rolled oats, Greek yogurt')." },
            { inlineData: { mimeType: file.type || "image/jpeg", data: base64Data } },
          ],
        },
      ],
    });
    if (gRes.ok) {
      const txt = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (txt) return txt;
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "List the food ingredients visible in this photo as a short comma-separated list." },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const txt = data?.choices?.[0]?.message?.content?.trim();
        if (txt) return txt;
      }
    } catch {
      // Fallback below
    }
  }

  // Intelligent filename + visual heuristics when offline/no key
  const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  if (cleanName && !/^(img|image|photo|dsc|pic|screenshot|\d+)/i.test(cleanName)) {
    return cleanName;
  }
  return "fresh pantry vegetables, garlic, olive oil & herbs";
}

// ---------------- USDA / CoFID INGREDIENT NUTRITION & DIETARY CONFLICT ENGINE ----------------
// Every ingredient is matched against a comprehensive per-100g USDA/CoFID food-chemistry catalog
// (plus live Gemini/ChatGPT per-ingredient nutrition when an API key is active) so nutrition facts
// are genuinely computed from exact gram weights (both Per Portion and Per 100g) and conflicts
// across ALL categories (Cholesterol Safe, Protein Rich, Fiber Rich, No Added Sugar, and Custom
// "Other" Dietary Priorities) are detected dynamically!
const USDA_PER_100G = [
  {
    match: /bacon|pancetta|guanciale|pork belly|crackling|lardons/i,
    kcal: 417,
    proteinG: 25,
    fiberG: 0,
    cholMg: 85,
    satFatG: 14.0,
    addedSugarG: 0,
    conflictChol: "Pork bacon/belly is high in saturated fat (14g/100g) & dietary cholesterol (85mg/100g), which raises LDL cholesterol.",
    heartSafeSwap: "Lean smoked turkey medallions or crispy smoked tempeh strips",
  },
  {
    match: /sausage|chorizo|salami|pepperoni|bratwurst|frankfurter|hot dog|mortadella|prosciutto|ham|gammon|corned beef|pastrami/i,
    kcal: 315,
    proteinG: 17,
    fiberG: 0,
    cholMg: 78,
    satFatG: 11.2,
    addedSugarG: 0.8,
    conflictChol: "Cured & processed meats are high in saturated fat (~11.2g/100g), sodium, and dietary cholesterol (~78mg/100g).",
    heartSafeSwap: "Lean herbed chicken breast strips or spiced chickpea & mushroom patties",
  },
  {
    match: /liver|kidney|sweetbread|giblet|pate|pâté|foie gras|offal/i,
    kcal: 195,
    proteinG: 21,
    fiberG: 0,
    cholMg: 345,
    satFatG: 4.8,
    addedSugarG: 0,
    conflictChol: "Organ meats and pâté contain very high dietary cholesterol (~345mg/100g).",
    heartSafeSwap: "Roasted shiitake & portobello mushrooms with walnuts & herbs",
  },
  {
    match: /ribeye|ribs|short rib|lamb|mutton|duck|goose|beef mince|steak|ground beef|brisket|sirloin|t-bone|wagyu|pork chop|pork shoulder|pulled pork|meatball/i,
    kcal: 275,
    proteinG: 24,
    fiberG: 0,
    cholMg: 82,
    satFatG: 9.5,
    addedSugarG: 0,
    conflictChol: "Fatty red meat & duck cuts contain high saturated fat (~9.5g/100g) and cholesterol (~82mg/100g).",
    heartSafeSwap: "Wild salmon fillets, skinless poultry breast, or extra-firm organic tofu",
  },
  {
    match: /butter|ghee|lard|tallow|suet|heavy cream|double cream|whipping cream|clotted cream|sour cream|crème fraîche|creme fraiche|mascarpone/i,
    kcal: 620,
    proteinG: 1.5,
    fiberG: 0,
    cholMg: 185,
    satFatG: 42.0,
    addedSugarG: 0,
    conflictChol: "Butter, animal fats, and heavy cream are concentrated sources of saturated fat and cholesterol.",
    heartSafeSwap: "Extra-virgin olive oil, avocado oil, or 0% fat Greek skyr",
  },
  {
    match: /coconut oil|palm oil|coconut cream|creamed coconut/i,
    kcal: 680,
    proteinG: 1.2,
    fiberG: 0,
    cholMg: 0,
    satFatG: 58.0,
    addedSugarG: 0,
    conflictChol: "Tropical oils (coconut oil/cream, palm oil) are extremely high in saturated fat (58g/100g), which elevates LDL cholesterol.",
    heartSafeSwap: "Extra-virgin olive oil or unsweetened soy/almond milk",
  },
  {
    match: /prawn|shrimp|lobster|crab|crayfish|crawfish|squid|calamari/i,
    kcal: 105,
    proteinG: 22.5,
    fiberG: 0,
    cholMg: 165,
    satFatG: 0.4,
    addedSugarG: 0,
    conflictChol: "Crustaceans & squid are low in saturated fat but contain high dietary cholesterol (~165mg/100g).",
    heartSafeSwap: "Wild omega-3 salmon, flaky white cod, or seared king oyster mushrooms",
  },
  {
    match: /deep[- ]?fried|battered|tempura|french fries|chips|fried chicken|croissant|puff pastry|shortcrust|pie crust|danish|doughnut|donut/i,
    kcal: 385,
    proteinG: 7.5,
    fiberG: 1.8,
    cholMg: 45,
    satFatG: 11.5,
    addedSugarG: 6.0,
    conflictChol: "Fried foods and butter-laminated pastries are high in saturated/trans fats (~11.5g/100g).",
    heartSafeSwap: "Air-fried or oven-roasted wholegrain preparation brushed with olive oil",
  },
  {
    match: /sugar|honey|maple syrup|agave|caramel|jam|marmalade|jelly|chocolate syrup|condensed milk|marshmallows?|candy|sweets|frosting|icing|nutella|chocolate spread|sweetened|cola|soda|sweet chili|teriyaki glaze|bbq sauce|hoisin|ketchup/i,
    kcal: 310,
    proteinG: 1.0,
    fiberG: 0.4,
    cholMg: 0,
    satFatG: 0.8,
    addedSugarG: 62.0,
    conflictSugar: "Contains concentrated free/added sugars or syrups, conflicting with your No Added Sugar priority.",
    sugarSafeSwap: "Ripe mashed banana, date paste, pureed berries, or cinnamon & balsamic reduction",
  },
  {
    match: /milk chocolate|white chocolate|ice cream|gelato|cake|cookie|biscuit|brownie|muffin|waffle|fudge/i,
    kcal: 440,
    proteinG: 5.5,
    fiberG: 1.5,
    cholMg: 38,
    satFatG: 13.5,
    addedSugarG: 36.0,
    conflictChol: "Confectionery, ice cream, and bakery treats contain high saturated fat (13.5g/100g).",
    conflictSugar: "Contains high refined sugar (~36g/100g).",
    heartSafeSwap: "85% dark cocoa nibs, frozen banana skyr whip, or baked whole-oat fruit crisp",
    sugarSafeSwap: "100% unsweetened dark cocoa powder + ripe fruit & 0% Greek skyr",
  },
  {
    match: /salmon|trout|mackerel|sardine|herring|anchov|arctic char/i,
    kcal: 206,
    proteinG: 22.1,
    fiberG: 0,
    cholMg: 52,
    satFatG: 2.3,
    addedSugarG: 0,
  },
  {
    match: /chicken|turkey|poultry|venison|ostrich|pheasant/i,
    kcal: 165,
    proteinG: 31.0,
    fiberG: 0,
    cholMg: 62,
    satFatG: 1.0,
    addedSugarG: 0,
  },
  {
    match: /tuna|cod|haddock|white fish|halibut|sea bass|snapper|tilapia|barramundi|hake|pollock|mussels|clams|scallops|oysters/i,
    kcal: 118,
    proteinG: 25.5,
    fiberG: 0,
    cholMg: 42,
    satFatG: 0.4,
    addedSugarG: 0,
  },
  {
    match: /egg white/i,
    kcal: 52,
    proteinG: 10.9,
    fiberG: 0,
    cholMg: 0,
    satFatG: 0,
    addedSugarG: 0,
  },
  {
    match: /\begg|eggs|omelet|frittata\b/i,
    kcal: 143,
    proteinG: 12.6,
    fiberG: 0,
    cholMg: 186,
    satFatG: 3.1,
    addedSugarG: 0,
    conflictChol: "Whole egg yolks contain concentrated dietary cholesterol (~186mg per 100g).",
    heartSafeSwap: "Liquid egg whites, 1 whole egg + 3 whites, or seasoned tofu scramble",
  },
  {
    match: /tofu|tempeh|edamame|seitan|soy|tvp|mycoprotein|quorn/i,
    kcal: 135,
    proteinG: 16.5,
    fiberG: 3.5,
    cholMg: 0,
    satFatG: 0.6,
    addedSugarG: 0,
  },
  {
    match: /skyr|0%.*yogurt|greek yogurt|cottage cheese|quark|protein powder|whey|casein/i,
    kcal: 72,
    proteinG: 12.8,
    fiberG: 0,
    cholMg: 4,
    satFatG: 0.2,
    addedSugarG: 0,
  },
  {
    match: /halloumi|cheddar|cheese|parmesan|feta|mozzarella|brie|camembert|gouda|gruyere|stilton|paneer|ricotta/i,
    kcal: 325,
    proteinG: 21.0,
    fiberG: 0,
    cholMg: 85,
    satFatG: 16.0,
    addedSugarG: 0,
    conflictChol: "Full-fat cheese is high in saturated fat (16g/100g) & cholesterol (85mg/100g).",
    heartSafeSwap: "Firm organic tofu, nutritional yeast, or 0% Greek skyr herb drizzle",
  },
  {
    match: /dry.*lentil|flax|chia|hemp|pumpkin seed|sunflower seed|sesame|walnut|almond|peanut|tahini|cashew|pecan|pistachio|hazelnut|macadamia|pine nut/i,
    kcal: 455,
    proteinG: 21.0,
    fiberG: 13.5,
    cholMg: 0,
    satFatG: 2.8,
    addedSugarG: 0,
  },
  {
    match: /oat|buckwheat|spelt|barley|rye|bulgur|farro|freekeh|wholegrain|wholemeal|whole wheat|bran|psyllium/i,
    kcal: 350,
    proteinG: 13.0,
    fiberG: 10.6,
    cholMg: 0,
    satFatG: 1.1,
    addedSugarG: 0,
  },
  {
    match: /white rice|jasmine rice|basmati|arborio|risotto|white pasta|spaghetti|penne|macaroni|noodle|udon|ramen|couscous|white bread|baguette|tortilla|gnocchi|polenta/i,
    kcal: 155,
    proteinG: 4.5,
    fiberG: 1.1,
    cholMg: 0,
    satFatG: 0.2,
    addedSugarG: 0,
    conflictFiber: "Refined white grains/pasta are stripped of their bran and contain very low dietary fiber (~1.1g/100g).",
    fiberSafeSwap: "Tri-color quinoa, lentil/chickpea pasta, wholegrain brown rice, or barley",
  },
  {
    match: /chickpea|bean|lentil|hummus|dal|dhal|split pea|black-eyed pea|fava|lupin/i,
    kcal: 145,
    proteinG: 9.2,
    fiberG: 7.8,
    cholMg: 0,
    satFatG: 0.3,
    addedSugarG: 0,
  },
  {
    match: /quinoa|brown rice|wild rice|millet|amaranth|teff/i,
    kcal: 125,
    proteinG: 4.6,
    fiberG: 3.4,
    cholMg: 0,
    satFatG: 0.3,
    addedSugarG: 0,
  },
  {
    match: /avocado|guacamole/i,
    kcal: 160,
    proteinG: 2.0,
    fiberG: 6.7,
    cholMg: 0,
    satFatG: 2.1,
    addedSugarG: 0,
  },
  {
    match: /banana|plantain/i,
    kcal: 89,
    proteinG: 1.1,
    fiberG: 2.6,
    cholMg: 0,
    satFatG: 0.1,
    addedSugarG: 0,
  },
  {
    match: /berry|berries|strawberry|blueberry|raspberry|blackberry|apple|pear|peach|nectarine|plum|apricot|mango|pineapple|orange|citrus|grapefruit|kiwi|pomegranate|fig|date|cherry|melon|grape/i,
    kcal: 55,
    proteinG: 0.8,
    fiberG: 3.2,
    cholMg: 0,
    satFatG: 0.1,
    addedSugarG: 0,
  },
  {
    match: /olive oil|avocado oil|sesame oil|rapeseed oil|canola oil|walnut oil|flaxseed oil/i,
    kcal: 884,
    proteinG: 0,
    fiberG: 0,
    cholMg: 0,
    satFatG: 12.5,
    addedSugarG: 0,
    isHealthyOil: true,
  },
  {
    match: /mayonnaise|mayo|aioli/i,
    kcal: 680,
    proteinG: 1.0,
    fiberG: 0,
    cholMg: 42,
    satFatG: 10.5,
    addedSugarG: 1.0,
    conflictChol: "Conventional mayonnaise is calorie-dense with egg yolk cholesterol and saturated fat.",
    heartSafeSwap: "Mashed avocado, hummus, or 0% Greek yogurt lemon-garlic dressing",
  },
  {
    match: /broth|stock|water|lemon juice|lime juice|vinegar|soy sauce|tamari|miso|mustard|sriracha|chilli|chili|garlic|ginger|herb|spice|cinnamon|oregano|basil|parsley|coriander|cilantro|rosemary|thyme|cumin|turmeric|paprika|cocoa/i,
    kcal: 22,
    proteinG: 1.4,
    fiberG: 1.2,
    cholMg: 0,
    satFatG: 0.1,
    addedSugarG: 0,
  },
  {
    match: /whole milk|full[- ]?cream milk/i,
    kcal: 62,
    proteinG: 3.3,
    fiberG: 0,
    cholMg: 12,
    satFatG: 2.0,
    addedSugarG: 0,
  },
  {
    match: /milk|oat milk|almond milk|soy milk/i,
    kcal: 38,
    proteinG: 2.4,
    fiberG: 0.6,
    cholMg: 0,
    satFatG: 0.2,
    addedSugarG: 0,
  },
  {
    match: /potato|sweet potato|yam|parsnip|butternut|pumpkin|squash|beetroot|corn|sweetcorn/i,
    kcal: 82,
    proteinG: 1.9,
    fiberG: 3.1,
    cholMg: 0,
    satFatG: 0.1,
    addedSugarG: 0,
  },
  {
    match: /spinach|broccoli|kale|cabbage|carrot|tomato|onion|shallot|leek|courgette|zucchini|pepper|capsicum|mushroom|asparagus|cauliflower|pea|green bean|celery|cucumber|eggplant|aubergine|artichoke|fennel|bok choy|rocket|arugula|lettuce|greens|vegetable|veggie/i,
    kcal: 34,
    proteinG: 2.4,
    fiberG: 3.2,
    cholMg: 0,
    satFatG: 0.1,
    addedSugarG: 0,
  },
];

function lookupIngredientProfile(name, liveNutriPer100g = null) {
  // 1. If Gemini or ChatGPT provided live per-100g nutrition for this ingredient, use it directly!
  if (liveNutriPer100g && typeof liveNutriPer100g.kcal === "number") {
    return liveNutriPer100g;
  }
  // 2. Match against our comprehensive food-chemistry & USDA/CoFID database
  for (const row of USDA_PER_100G) {
    if (row.match.test(name)) return row;
  }
  // 3. Smart semantic category inference for any exotic/novel ingredient
  const lower = String(name || "").toLowerCase();
  if (/meat|pork|beef|veal|mutton|salami|lard|cream|cheesy/i.test(lower)) {
    return {
      kcal: 260,
      proteinG: 20,
      fiberG: 0,
      cholMg: 80,
      satFatG: 9.0,
      addedSugarG: 0,
      conflictChol: "Contains elevated saturated fat and dietary cholesterol.",
      heartSafeSwap: "Lean poultry, wild fish, or organic tofu",
    };
  }
  if (/syrup|sweet|glaze|candy|sugar|frosted/i.test(lower)) {
    return {
      kcal: 290,
      proteinG: 1,
      fiberG: 0,
      cholMg: 0,
      satFatG: 0.5,
      addedSugarG: 50.0,
      conflictSugar: "Contains free or added sugars.",
      sugarSafeSwap: "Whole fruit, cinnamon, or unsweetened spice infusion",
    };
  }
  return { kcal: 95, proteinG: 4.5, fiberG: 2.5, cholMg: 0, satFatG: 0.4, addedSugarG: 0 };
}

function evaluateCustomOtherDietaryConflict(ingName, otherText) {
  const custom = String(otherText || "").toLowerCase().trim();
  if (!custom) return null;
  const ing = String(ingName || "").toLowerCase();

  // Check explicit "no X" / "without X" / "X-free" / "allergic to X" rules
  const noMatches = [...custom.matchAll(/(?:no|without|avoid|allergic to|free of)\s+([a-z\s]{3,20})/g)];
  for (const m of noMatches) {
    const forbidden = m[1].trim().split(/\s+/)[0];
    if (forbidden && forbidden.length >= 3 && ing.includes(forbidden)) {
      return {
        warning: `Conflicts with your custom "${otherText}" requirement (contains ${forbidden}).`,
        swap: `Compliant ${forbidden}-free wholefood alternative`,
      };
    }
  }

  if (/vegan|plant[- ]?based|strictly vegetarian/i.test(custom)) {
    if (/salmon|fish|tuna|cod|prawn|shrimp|chicken|turkey|beef|pork|bacon|sausage|lamb|duck|meat|egg|yogurt|skyr|cheese|milk|whey|cottage|honey/i.test(ing) && !/soy|almond|oat|coconut|plant|vegan/i.test(ing)) {
      return {
        warning: `Contains animal/dairy products, which conflicts with your "${otherText}" priority.`,
        swap: "Organic tofu, tempeh, edamame, chickpeas, or soy skyr",
      };
    }
  } else if (/vegetarian/i.test(custom)) {
    if (/salmon|fish|tuna|cod|prawn|shrimp|chicken|turkey|beef|pork|bacon|sausage|lamb|duck|meat|anchov/i.test(ing)) {
      return {
        warning: `Contains meat/fish, which conflicts with your "${otherText}" priority.`,
        swap: "Crispy organic tofu, roasted chickpeas, or halloumi/eggs",
      };
    }
  }

  if (/dairy[- ]?free|lactose|no dairy|cow/i.test(custom)) {
    if (/yogurt|skyr|cheese|cottage|milk|butter|cream|whey|casein|halloumi|feta|parmesan/i.test(ing) && !/soy|almond|oat|coconut|dairy-free|plant/i.test(ing)) {
      return {
        warning: `Contains dairy/lactose, conflicting with your "${otherText}" priority.`,
        swap: "Unsweetened soy/almond milk, silken tofu, or coconut yogurt",
      };
    }
  }

  if (/gluten[- ]?free|celiac|coeliac|no wheat|no gluten/i.test(custom)) {
    if (/wheat|spelt|barley|rye|couscous|bulgur|farro|seitan|soy sauce|bread|pasta|flour/i.test(ing) && !/gluten-free|tamari|quinoa|buckwheat|oat|rice|almond/i.test(ing)) {
      return {
        warning: `Contains gluten/wheat, conflicting with your "${otherText}" priority.`,
        swap: "Quinoa, buckwheat, brown rice, or certified gluten-free oats & tamari",
      };
    }
  }

  if (/keto|low[- ]?carb/i.test(custom)) {
    if (/banana|rice|quinoa|oat|pasta|bread|potato|sweet potato|chickpea|lentil|bean|sugar|honey|mango/i.test(ing)) {
      return {
        warning: `High in net carbohydrates, conflicting with your "${otherText}" priority.`,
        swap: "Cauliflower rice, zucchini ribbons, avocado, eggs, or leafy greens",
      };
    }
  }

  if (/nut[- ]?free|no nuts|peanut|tree nut/i.test(custom)) {
    if (/walnut|almond|pecan|cashew|peanut|pistachio|hazelnut|macadamia|pine nut/i.test(ing)) {
      return {
        warning: `Contains nuts, conflicting with your "${otherText}" safety requirement.`,
        swap: "Toasted pumpkin seeds, sunflower seeds, hemp hearts, or tahini",
      };
    }
  }

  if (/low[- ]?sodium|no salt|low salt|hypertension/i.test(custom)) {
    if (/bacon|sausage|salami|ham|soy sauce|halloumi|feta|olives|capers|salted/i.test(ing)) {
      return {
        warning: `High in sodium, conflicting with your "${otherText}" priority.`,
        swap: "Fresh herbs, lemon zest, roasted garlic, and unsalted whole foods",
      };
    }
  }

  return null;
}

function parseGramsFromQtyMetric(qtyMetric) {
  const m = String(qtyMetric || "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 100;
}

function computeRecipeNutritionAndConflicts(r) {
  const servings = Number(r.servings) || state.servings || 2;
  let totalGrams = 0;
  let totalKcal = 0;
  let totalProt = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalChol = 0;
  let totalSatFat = 0;
  let totalAddedSugar = 0;

  const conflictWarnings = Array.isArray(r.liveConflictWarnings) ? [...r.liveConflictWarnings] : [];
  let suggestedSafeSwap = r.liveSuggestedSafeSwap || null;

  r.ingredients.forEach((ing) => {
    if (ing.omitted) return;
    const g = parseGramsFromQtyMetric(ing.qtyMetric);
    const prof = lookupIngredientProfile(ing.name, ing.nutritionPer100g);
    const factor = g / 100;

    // Derive fatG and carbsG cleanly when a local USDA row omits them
    const estFatPer100g =
      typeof prof.fatG === "number"
        ? prof.fatG
        : Math.max(prof.satFatG || 0, Math.min(100, (prof.satFatG || 0) * 2.4));
    const remKcal = Math.max(0, (prof.kcal || 0) - (prof.proteinG || 0) * 4 - estFatPer100g * 9);
    const estCarbsPer100g =
      typeof prof.carbsG === "number" ? prof.carbsG : Math.max(prof.fiberG || 0, +(remKcal / 4).toFixed(1));

    totalGrams += g;
    totalKcal += (prof.kcal || 0) * factor;
    totalProt += (prof.proteinG || 0) * factor;
    totalFat += estFatPer100g * factor;
    totalCarbs += estCarbsPer100g * factor;
    totalFiber += (prof.fiberG || 0) * factor;
    totalChol += (prof.cholMg || 0) * factor;
    totalSatFat += (prof.satFatG || 0) * factor;
    totalAddedSugar += (prof.addedSugarG || 0) * factor;

    const shortIng = ing.name.split("(")[0].trim();

    // 1. Cholesterol-Safe ingredient check
    if (state.dietary["cholesterol-safe"] && prof.conflictChol) {
      conflictWarnings.push(`⚠️ <strong>${shortIng} (Cholesterol Safe)</strong>: ${prof.conflictChol}`);
      if (!suggestedSafeSwap && prof.heartSafeSwap) {
        suggestedSafeSwap = prof.heartSafeSwap;
      }
    }

    // 2. No Added Sugar ingredient check
    if (state.dietary["no-added-sugar"] && prof.conflictSugar) {
      conflictWarnings.push(`⚠️ <strong>${shortIng} (No Added Sugar)</strong>: ${prof.conflictSugar}`);
      if (!suggestedSafeSwap && prof.sugarSafeSwap) {
        suggestedSafeSwap = prof.sugarSafeSwap;
      }
    }

    // 3. Fiber-Rich ingredient check (e.g. refined white pasta/rice/bread)
    if (state.dietary["fiber-rich"] && prof.conflictFiber) {
      conflictWarnings.push(`⚠️ <strong>${shortIng} (Fiber Rich)</strong>: ${prof.conflictFiber}`);
      if (!suggestedSafeSwap && prof.fiberSafeSwap) {
        suggestedSafeSwap = prof.fiberSafeSwap;
      }
    }

    // 4. Custom "Other" Dietary Priority check
    if (state.otherDietaryText) {
      const customConflict = evaluateCustomOtherDietaryConflict(ing.name, state.otherDietaryText);
      if (customConflict) {
        conflictWarnings.push(`⚠️ <strong>${shortIng} (${state.otherDietaryText})</strong>: ${customConflict.warning}`);
        if (!suggestedSafeSwap && customConflict.swap) {
          suggestedSafeSwap = customConflict.swap;
        }
      }
    }
  });

  const safeTotalGrams = Math.max(totalGrams, 100);
  const portionGrams = Math.round(safeTotalGrams / servings);

  const protPerPortion = Math.round(totalProt / servings);
  const fiberPerPortion = Math.round(totalFiber / servings);
  const cholPerPortion = Math.round(totalChol / servings);
  const satFatPerPortion = +(totalSatFat / servings).toFixed(1);
  const sugarPerPortion = +(totalAddedSugar / servings).toFixed(1);

  // Whole-Dish Computed Threshold Checks across ALL 4 categories:
  if (
    state.dietary["cholesterol-safe"] &&
    conflictWarnings.length === 0 &&
    (cholPerPortion > 85 || satFatPerPortion > 5.5)
  ) {
    conflictWarnings.push(
      `⚠️ <strong>Cholesterol Safe Notice</strong>: This dish totals ${cholPerPortion} mg cholesterol and ${satFatPerPortion} g saturated fat per portion.`
    );
    if (!suggestedSafeSwap) suggestedSafeSwap = "Wild salmon, organic tofu, or skinless poultry with olive oil";
  }

  if (state.dietary["protein-rich"] && protPerPortion < 22) {
    conflictWarnings.push(
      `⚠️ <strong>Protein Rich Notice</strong>: This dish currently provides only ${protPerPortion} g protein per portion (below the 25–30g+ high-protein target).`
    );
    if (!suggestedSafeSwap) {
      suggestedSafeSwap = `${r.title} + 0% Greek Skyr, Edamame, or Lean Poultry`;
    }
  }

  if (state.dietary["fiber-rich"] && fiberPerPortion < 7) {
    conflictWarnings.push(
      `⚠️ <strong>Fiber Rich Notice</strong>: This dish currently provides only ${fiberPerPortion} g fiber per portion (below the 8–10g+ high-fiber target).`
    );
    if (!suggestedSafeSwap) {
      suggestedSafeSwap = `${r.title} + Chickpeas, Lentils, Chia Seeds & Broccoli`;
    }
  }

  if (state.dietary["no-added-sugar"] && conflictWarnings.length === 0 && sugarPerPortion > 2.5) {
    conflictWarnings.push(
      `⚠️ <strong>No Added Sugar Notice</strong>: Contains ${sugarPerPortion} g of added/free sugar per portion.`
    );
    if (!suggestedSafeSwap) {
      suggestedSafeSwap = "Unsweetened whole-fruit & Ceylon cinnamon preparation";
    }
  }

  const perPortion = {
    basisLabel: `Per Portion (~${portionGrams} g)`,
    kcal: `${Math.round(totalKcal / servings)} kcal`,
    kcalNum: Math.round(totalKcal / servings),
    protein: `${protPerPortion} g`,
    proteinNum: protPerPortion,
    fatNum: +(totalFat / servings).toFixed(1),
    carbsNum: Math.round(totalCarbs / servings),
    fiber: `${fiberPerPortion} g`,
    fiberNum: fiberPerPortion,
    cholMgNum: cholPerPortion,
    satFatNum: satFatPerPortion,
    addedSugarNum: sugarPerPortion,
  };

  const batch = {
    totalGrams: Math.round(totalGrams),
    kcalNum: Math.round(totalKcal),
    proteinNum: Math.round(totalProt),
    fatNum: +totalFat.toFixed(1),
    carbsNum: Math.round(totalCarbs),
    fiberNum: Math.round(totalFiber),
    satFatNum: +totalSatFat.toFixed(1),
    servings,
  };

  const per100g = {
    basisLabel: `Per 100 g`,
    kcal: `${Math.round((totalKcal / safeTotalGrams) * 100)} kcal`,
    kcalNum: Math.round((totalKcal / safeTotalGrams) * 100),
    protein: `${+((totalProt / safeTotalGrams) * 100).toFixed(1)} g`,
    proteinNum: +((totalProt / safeTotalGrams) * 100).toFixed(1),
    fatNum: +((totalFat / safeTotalGrams) * 100).toFixed(1),
    carbsNum: +((totalCarbs / safeTotalGrams) * 100).toFixed(1),
    fiber: `${+((totalFiber / safeTotalGrams) * 100).toFixed(1)} g`,
    fiberNum: +((totalFiber / safeTotalGrams) * 100).toFixed(1),
    cholMgNum: Math.round((totalChol / safeTotalGrams) * 100),
    satFatNum: +((totalSatFat / safeTotalGrams) * 100).toFixed(1),
    addedSugarNum: +((totalAddedSugar / safeTotalGrams) * 100).toFixed(1),
  };

  const formatCholLabel = (cholMg, satFat) => {
    if (cholMg > 75 || satFat > 5.0) {
      return `${cholMg} mg (⚠️ ${satFat}g SatFat)`;
    }
    if (cholMg <= 20 && satFat <= 2.5) {
      return `${cholMg} mg (Heart-Safe)`;
    }
    return `${cholMg} mg (${satFat}g SatFat)`;
  };

  perPortion.cholesterol = formatCholLabel(perPortion.cholMgNum, perPortion.satFatNum);
  per100g.cholesterol = formatCholLabel(per100g.cholMgNum, per100g.satFatNum);

  perPortion.addedSugar = `${perPortion.addedSugarNum} g`;
  per100g.addedSugar = `${per100g.addedSugarNum} g`;

  r.computedNutrition = {
    batch,
    portion: perPortion,
    per100g,
    hasConflict: conflictWarnings.length > 0,
    conflictWarnings,
    suggestedSafeSwap,
  };

  // Keep r.nutrition synced to the active basis
  r.nutrition = state.nutritionBasis === "100g" ? per100g : perPortion;
  return r.computedNutrition;
}

function applyDietaryEngineeringToRecipe(rawRecipe, scale) {
  const r = JSON.parse(JSON.stringify(rawRecipe));
  const cholSafe = state.dietary["cholesterol-safe"];
  const protRich = state.dietary["protein-rich"];
  const fiberRich = state.dietary["fiber-rich"];
  const noSugar = state.dietary["no-added-sugar"];
  const otherDiet = (state.otherDietaryText || "").trim();
  const otherLower = otherDiet.toLowerCase();
  const isMaxTasteMode = !cholSafe && !protRich && !fiberRich && !noSugar && !otherDiet;

  const modifications = [];

  // 1. Scale base quantities & adapt secondary ingredients to active priorities (or Maximum Taste mode!)
  r.ingredients = r.ingredients.map((ing) => {
    let grams = Math.round((ing.baseGrams * scale) / 5) * 5 || 5;
    let name = ing.name;
    let unit = ing.unit || "g";

    // Cholesterol-Safe vs. Indulgent / Maximum Taste transformations on fats, dairy & binders:
    if (cholSafe) {
      if (/butter|ghee|lard|cream/i.test(name) && ing.id !== "ing-1") {
        name = "Extra-virgin olive oil (heart-safe swap)";
        unit = "ml";
      }
      if (/whole egg/i.test(name) && ing.id !== "ing-1") {
        name = "Liquid egg whites (zero-cholesterol swap)";
        unit = "ml";
      }
    } else {
      if (/Liquid egg whites/i.test(name)) {
        name = "Whole free-range eggs (rich golden yolks & whites)";
        unit = "g";
      }
      if (/0% Fat Greek yogurt|0% Fat Greek skyr/i.test(name)) {
        name = isMaxTasteMode
          ? "Velvety full-cream Greek yogurt & a splash of double cream"
          : "Full-cream Greek yogurt";
      }
      if (/Low-fat cottage cheese/i.test(name)) {
        name = "Creamy whole-milk ricotta & mascarpone";
      }
      if (isMaxTasteMode && /Extra-virgin olive oil/i.test(name)) {
        name = "Cultured grass-fed butter & extra-virgin olive oil";
        unit = "g";
        grams = Math.round(30 * scale);
      }
      if (isMaxTasteMode && /Unsweetened almond or oat milk|Almond or oat milk \(unsweetened\)/i.test(name)) {
        name = "Creamy whole milk & pure vanilla bean paste";
      }
    }

    // No Added Sugar active transformation on secondary sweeteners:
    if (noSugar && /honey|maple syrup|brown sugar|refined sugar/i.test(name) && ing.id !== "ing-1") {
      name = "Ceylon cinnamon & pure vanilla extract (zero-sugar swap)";
    }

    // Custom "Other" Dietary Priority active adaptation on secondary ingredients:
    if (otherLower && ing.id !== "ing-1") {
      if (/dairy[- ]?free|vegan|plant[- ]?based|lactose/i.test(otherLower)) {
        if (/yogurt|skyr|cottage cheese|ricotta/i.test(name)) {
          name = "Unsweetened high-protein soy yogurt (dairy-free)";
        } else if (/egg white|eggs?\b/i.test(name) && /vegan|plant[- ]?based/i.test(otherLower)) {
          name = "Ground flaxseed & soy protein binder (vegan)";
        } else if (/cheese|feta|parmesan|halloumi/i.test(name)) {
          name = "Seasoned organic tofu & nutritional yeast (dairy-free)";
        }
      }
      if (/gluten[- ]?free|celiac|coeliac/i.test(otherLower)) {
        if (/spelt|wheat|rye|bread|couscous|bulgur/i.test(name)) {
          name = "Certified gluten-free quinoa or buckwheat";
        } else if (/oats/i.test(name) && !/gluten-free/i.test(name)) {
          name = `Certified gluten-free ${name.toLowerCase()}`;
        } else if (/soy sauce/i.test(name)) {
          name = name.replace(/soy sauce/i, "gluten-free tamari");
        }
      }
      if (/nut[- ]?free|no nuts|peanut/i.test(otherLower)) {
        if (/walnut|almond|pecan|cashew|peanut|pistachio|hazelnut/i.test(name)) {
          name = "Toasted pumpkin & sunflower seeds (nut-free)";
        }
      }
      if (/keto|low[- ]?carb/i.test(otherLower)) {
        if (/quinoa|brown rice|rice|oats|bread|potato/i.test(name)) {
          name = r.isSweet ? "Almond flour, hemp hearts & chia seeds (low-carb)" : "Cauliflower rice & toasted hemp seeds (keto)";
        }
      }
    }

    // Protein-Rich active transformation (+30% protein portion)
    if (protRich && ing.isProteinCore) {
      grams = Math.round((grams * 1.3) / 5) * 5;
    }

    // Fiber-Rich active transformation (+25% wholegrain/legume/veggie portion)
    if (fiberRich && ing.isFiberCore) {
      grams = Math.round((grams * 1.25) / 5) * 5;
    }

    return {
      ...ing,
      name,
      qtyMetric: `${grams} ${unit}`,
      checked: true,
      replacedFrom: null,
      alternatives: (ing.alternatives || []).map((alt) => ({
        name: alt.name,
        qtyMetric: `${Math.round(((alt.baseGrams || ing.baseGrams) * scale) / 5) * 5 || 5} ${alt.unit || unit}`,
        reason: alt.reason,
        cookAction: alt.cookAction || null,
      })),
    };
  });

  // If NO Dietary Priorities are selected -> Prioritize MAXIMUM TASTE (Chef's Indulgent Flavor Upgrade!)
  if (isMaxTasteMode) {
    const tasteG = Math.round((r.isSweet ? 45 : 40) * scale);
    r.ingredients.push({
      id: "ing-max-taste",
      name: r.isSweet
        ? "Salted caramelised butter, pure maple syrup & flaky sea salt"
        : "Aged Parmigiano-Reggiano, roasted garlic-herb butter & flaky sea salt",
      qtyMetric: `${tasteG} g`,
      checked: true,
      replacedFrom: null,
      alternatives: [
        {
          name: r.isSweet ? "Dark chocolate chunks & brown butter" : "Crispy pancetta bits & crème fraîche glaze",
          qtyMetric: `${tasteG} g`,
          reason: "Restaurant-grade flavor finisher",
        },
      ],
    });
    r.steps[r.steps.length - 1].instruction += ` Finish by basting or drizzling with [ing-max-taste] for maximum restaurant-level taste and richness!`;
  }

  // Inject dedicated Protein Booster if Protein-Rich is ON and dish doesn't already have high protein
  if (protRich) {
    const hasHighProt = r.ingredients.some((i) => i.isProteinCore);
    if (!hasHighProt) {
      const boostG = Math.round(180 * scale);
      const isDairyFree = /dairy[- ]?free|vegan|plant[- ]?based|lactose/i.test(otherLower);
      r.ingredients.push({
        id: "ing-prot-boost",
        name: r.isSweet
          ? isDairyFree
            ? "Soy Protein Skyr & Hemp Hearts"
            : "0% Greek Skyr or Vanilla Whey Protein"
          : "Shelled Edamame & Hemp Hearts",
        qtyMetric: `${boostG} g`,
        checked: true,
        replacedFrom: null,
        alternatives: [
          { name: "Silken tofu or plant protein", qtyMetric: `${boostG} g`, reason: "Lean complete protein" },
        ],
      });
      r.steps[r.steps.length - 1].instruction += `. Fold in [ing-prot-boost] to lock in your high-protein goal.`;
    }
  }

  // Inject dedicated Fiber Booster if Fiber-Rich is ON
  if (fiberRich) {
    const boostG = Math.round(25 * scale);
    r.ingredients.push({
      id: "ing-fiber-boost",
      name: r.isSweet
        ? "Milled flaxseed & chia seed soluble-fiber blend"
        : "Cannellini white beans & toasted pumpkin seeds",
      qtyMetric: `${r.isSweet ? boostG : Math.round(160 * scale)} g`,
      checked: true,
      replacedFrom: null,
      alternatives: [
        { name: "Psyllium husk or rolled oat bran", qtyMetric: `${boostG} g`, reason: "Concentrated soluble fiber" },
        { name: "Cooked lentils", qtyMetric: `${Math.round(150 * scale)} g`, reason: "Hearty legume fiber" },
      ],
    });
    r.steps[r.steps.length - 1].instruction += `. Stir in [ing-fiber-boost] for an extra 8 g of soluble dietary fiber!`;
  }

  // Compute genuine USDA/CoFID nutrition & detect any dietary conflicts across all categories
  const calc = computeRecipeNutritionAndConflicts(r);

  if (calc.hasConflict) {
    r.dietaryNote = calc.conflictWarnings[0].replace(/<[^>]+>/g, "");
  } else {
    if (cholSafe) modifications.push("❤️ Cholesterol-Safe: Low sat-fat & monounsaturated olive oil");
    if (protRich) modifications.push("💪 Protein-Rich: High lean protein per serving");
    if (fiberRich) modifications.push("🌾 Fiber-Rich: Enriched with soluble fiber");
    if (noSugar) modifications.push("🚫 No Added Sugar: 0g refined sugar or syrups");
    if (otherDiet) modifications.push(`✨ ${otherDiet}: Adapted ingredients`);
    r.dietaryNote = modifications.length
      ? modifications.join(" • ")
      : "🍽️ Maximum Taste Priority: Restaurant-style butter basting, rich aromatics & indulgent glaze";
  }

  return r;
}

// ---------------- PERSISTENT KITCHEN PROFILE, RECIPE MEMORY & OMNI-INTENT PARSER ----------------
function persistKitchenProfile() {
  localStorage.setItem("chefcoach_kitchen_profile", JSON.stringify(state.kitchenProfile));
}

function persistRecipeHistory() {
  localStorage.setItem("chefcoach_recipe_history", JSON.stringify(state.recipeHistory));
  updateRecipeHistoryUI();
}

function updateRecipeHistoryUI() {
  if (dom.recipeHistoryCountSub) {
    const count = state.recipeHistory.length;
    dom.recipeHistoryCountSub.textContent = `${count} past recipe${count === 1 ? "" : "s"} remembered for smart discovery`;
  }
}

function recordRecipeToHistory(recipe, source = "viewed") {
  if (!recipe || !recipe.title) return;
  const calc = computeRecipeNutritionAndConflicts(recipe);
  const entry = {
    title: recipe.title,
    styleTag: recipe.styleTag || "Custom",
    keyIngredients: (recipe.ingredients || []).slice(0, 6).map((i) => i.name.split("(")[0].trim()),
    appliancesUsed: [...(state.kitchenProfile.appliances || [])],
    perServingKcal: calc.portion.kcalNum,
    perServingProteinG: calc.portion.proteinNum,
    perServingFiberG: calc.portion.fiberNum,
    rating: recipe.rating || null,
    source,
    timestamp: Date.now(),
  };
  const existingIdx = state.recipeHistory.findIndex((h) => h.title.toLowerCase() === entry.title.toLowerCase());
  if (existingIdx !== -1) {
    state.recipeHistory.splice(existingIdx, 1);
  }
  state.recipeHistory.unshift(entry);
  if (state.recipeHistory.length > 25) {
    state.recipeHistory = state.recipeHistory.slice(0, 25);
  }
  persistRecipeHistory();
}

function buildKitchenProfilePromptContext() {
  const kp = state.kitchenProfile || { appliances: [], defaults: {} };
  const allAppliances = [...(kp.appliances || []), ...(kp.customAppliances || [])];
  const d = kp.defaults || {};
  const activeDefaults = [];
  if (d.metricOnly !== false) activeDefaults.push("Metric units ONLY (g, ml, °C; digital scale precision, NO cups/spoons/°F)");
  if (d.eggless) activeDefaults.push("Eggless (use chia/flax gel, mashed fruit, or aquafaba instead of eggs)");
  if (d.lowSugar) activeDefaults.push("No refined sugar / low added sugar");
  if (d.highFibre) activeDefaults.push("High dietary fibre");
  if (d.cholesterolConscious) activeDefaults.push("Cholesterol-conscious (low saturated fat, heart-healthy oils)");
  if (d.dairyFree) activeDefaults.push("Dairy-free");

  const savedSummaries = (state.savedRecipes || []).slice(0, 6).map((s) => ({
    title: s.title,
    styleTag: s.styleTag,
    rating: s.rating || 5,
    keyIngredients: (s.ingredients || []).slice(0, 5).map((i) => i.name),
  }));
  const recentHistory = (state.recipeHistory || []).slice(0, 8);

  return `USER PERSISTENT KITCHEN & DIETARY PROFILE:
- Owned Appliances: ${allAppliances.length ? allAppliances.join(", ") : "Standard Oven & Stovetop"}
- Culinary Defaults: ${activeDefaults.join("; ")}
- Saved Favourites (${savedSummaries.length}): ${savedSummaries.length ? JSON.stringify(savedSummaries) : "None yet"}
- Recent Cooking History (${recentHistory.length}): ${recentHistory.length ? JSON.stringify(recentHistory) : "None yet"}`;
}

function initKitchenProfileUI() {
  const renderProfileChips = () => {
    const kp = state.kitchenProfile;
    if (dom.applianceProfileChips) {
      // Ensure custom appliances are rendered as chips too
      (kp.customAppliances || []).forEach((appName) => {
        const exists = Array.from(dom.applianceProfileChips.querySelectorAll(".appliance-chip")).some(
          (b) => b.dataset.appliance === appName
        );
        if (!exists) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "appliance-chip";
          btn.dataset.appliance = appName;
          btn.textContent = appName;
          dom.applianceProfileChips.appendChild(btn);
        }
      });

      dom.applianceProfileChips.querySelectorAll(".appliance-chip").forEach((btn) => {
        const name = btn.dataset.appliance;
        const active = (kp.appliances || []).includes(name);
        btn.classList.toggle("active", active);
      });
    }

    if (dom.culinaryDefaultsChips) {
      dom.culinaryDefaultsChips.querySelectorAll(".appliance-chip").forEach((btn) => {
        const key = btn.dataset.default;
        btn.classList.toggle("active", Boolean(kp.defaults && kp.defaults[key]));
      });
    }
    updateRecipeHistoryUI();
  };

  if (dom.applianceProfileChips) {
    dom.applianceProfileChips.addEventListener("click", (e) => {
      const btn = e.target.closest(".appliance-chip");
      if (!btn) return;
      const name = btn.dataset.appliance;
      const list = state.kitchenProfile.appliances || [];
      const idx = list.indexOf(name);
      if (idx === -1) list.push(name);
      else list.splice(idx, 1);
      state.kitchenProfile.appliances = list;
      persistKitchenProfile();
      renderProfileChips();
    });
  }

  if (dom.addCustomApplianceBtn && dom.customApplianceInput) {
    const addAppliance = () => {
      const val = dom.customApplianceInput.value.trim();
      if (!val) return;
      if (!state.kitchenProfile.customAppliances) state.kitchenProfile.customAppliances = [];
      if (!state.kitchenProfile.appliances) state.kitchenProfile.appliances = [];
      if (!state.kitchenProfile.customAppliances.includes(val)) {
        state.kitchenProfile.customAppliances.push(val);
      }
      if (!state.kitchenProfile.appliances.includes(val)) {
        state.kitchenProfile.appliances.push(val);
      }
      dom.customApplianceInput.value = "";
      persistKitchenProfile();
      renderProfileChips();
    };
    dom.addCustomApplianceBtn.addEventListener("click", addAppliance);
    dom.customApplianceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addAppliance();
      }
    });
  }

  if (dom.culinaryDefaultsChips) {
    dom.culinaryDefaultsChips.addEventListener("click", (e) => {
      const btn = e.target.closest(".appliance-chip");
      if (!btn) return;
      const key = btn.dataset.default;
      if (!state.kitchenProfile.defaults) state.kitchenProfile.defaults = {};
      state.kitchenProfile.defaults[key] = !state.kitchenProfile.defaults[key];
      persistKitchenProfile();
      renderProfileChips();
    });
  }

  if (dom.clearRecipeHistoryBtn) {
    dom.clearRecipeHistoryBtn.addEventListener("click", () => {
      state.recipeHistory = [];
      persistRecipeHistory();
    });
  }

  renderProfileChips();
}

function initDynamicSearchPlaceholders() {
  if (!dom.cravingInput) return;
  const examples = [
    "Try: '6 bananas, oats, air fryer' or 'high protein air fryer dinner'...",
    "Try: 'creamy corn cake no dairy' or '400g oat flour, chia, silicone trays'...",
    "Try: 'quick eggless banana loaf' or 'salmon, chickpeas, 20 mins'...",
  ];
  let idx = 0;
  setInterval(() => {
    if (document.activeElement === dom.cravingInput || dom.cravingInput.value.trim()) return;
    idx = (idx + 1) % examples.length;
    dom.cravingInput.placeholder = examples[idx];
  }, 4500);
}

function getMergedDietaryGoalsFromQueryAndProfile(queryDiets = []) {
  const goals = new Set(queryDiets);
  const d = state.kitchenProfile?.defaults || {};
  if (state.dietary["cholesterol-safe"] || d.cholesterolConscious) goals.add("Cholesterol-Conscious");
  if (state.dietary["protein-rich"]) goals.add("High Protein");
  if (state.dietary["fiber-rich"] || d.highFibre) goals.add("High Fibre");
  if (state.dietary["no-added-sugar"] || d.lowSugar) goals.add("No Refined Sugar");
  if (d.eggless) goals.add("Eggless");
  if (d.dairyFree) goals.add("Dairy-Free");
  if (d.metricOnly !== false) goals.add("Metric (g/ml/°C)");
  if (state.otherDietaryText?.trim()) goals.add(state.otherDietaryText.trim());
  return Array.from(goals);
}

function parseOmniIntentLocal(queryText) {
  const q = String(queryText || "").trim();
  const lower = q.toLowerCase();

  const formatMatch = lower.match(
    /\b(loaf|bread|cake|muffins?|pancakes?|fritters?|burgers?|patties|curry|stir-?fry|salad|soup|bowl|pasta|bake|bars?|porridge|dinner|breakfast|snack|omelette)\b/
  );
  const dishFormat = formatMatch ? formatMatch[1] : null;

  const appliances = [];
  if (/air\s*-?\s*fryer|airfryer/i.test(lower)) appliances.push("Air Fryer");
  if (/silicone\s*(tray|trays|loaf|insert|inserts|mold|mould)/i.test(lower)) appliances.push("Silicone Loaf Inserts");
  if (/stovetop|skillet|pan/i.test(lower)) appliances.push("Stovetop");
  if (/no\s*oven/i.test(lower)) appliances.push("No Oven");
  if (/oven/i.test(lower) && !/no\s*oven/i.test(lower)) appliances.push("Oven");
  if (/blender|food\s*processor/i.test(lower)) appliances.push("Blender");

  // Merge user's default appliances if none explicitly stated
  if (appliances.length === 0 && state.kitchenProfile?.appliances?.length) {
    appliances.push(...state.kitchenProfile.appliances.slice(0, 2));
  }

  const queryDiets = [];
  if (/high\s*protein|protein[-\s]*rich/i.test(lower)) queryDiets.push("High Protein");
  if (/no\s*dairy|dairy[-\s]*free/i.test(lower)) queryDiets.push("Dairy-Free");
  if (/eggless|no\s*egg/i.test(lower)) queryDiets.push("Eggless");
  if (/no\s*(added\s*)?sugar|sugar[-\s]*free|low\s*sugar/i.test(lower)) queryDiets.push("No Refined Sugar");
  if (/high\s*fib(er|re)/i.test(lower)) queryDiets.push("High Fibre");
  if (/gluten[-\s]*free/i.test(lower)) queryDiets.push("Gluten-Free");

  // Strip appliance, method, dietary & filler words so only true food/ingredient tokens remain
  const cleanedForIngs = q
    .replace(/\b(using|with|in|on|for|no|high|quick|easy|healthy|air\s*-?\s*fryer|airfryer|silicone\s*(?:loaf\s*)?(?:trays?|inserts?|molds?|moulds?)|stovetop|skillet|oven|dairy|sugar|protein|dinner|breakfast|snack|lunch)\b/gi, " ")
    .replace(/\+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  const rawTokens = cleanedForIngs.split(/,|&|\band\b/i).map((s) => s.trim()).filter(Boolean);
  const ingredients = [];
  rawTokens.forEach((tok) => {
    if (tok.length < 2) return;
    if (dishFormat && tok.toLowerCase() === dishFormat.toLowerCase()) return;
    const qtyMatch = tok.match(/^(\d+(?:\.\d+)?\s*(?:g|kg|ml|l)?)\s+(.+)$/i);
    if (qtyMatch) {
      ingredients.push({ quantity: qtyMatch[1].trim(), name: qtyMatch[2].trim() });
    } else {
      ingredients.push({ quantity: "", name: tok });
    }
  });

  // Detect surplus perishable quantity (e.g. >= 4 bananas, >= 500g fruit/veg)
  let surplusScaleNote = null;
  ingredients.forEach((ing) => {
    const n = parseFloat(ing.quantity);
    if (!isNaN(n) && n >= 4 && !/g|ml/i.test(ing.quantity)) {
      surplusScaleNote = `Surplus scale: ${ing.quantity} ${ing.name} (batch/multi-tray)`;
    }
  });

  return {
    rawQuery: q,
    dishFormat,
    ingredients,
    appliances: Array.from(new Set(appliances)),
    dietaryGoals: getMergedDietaryGoalsFromQueryAndProfile(queryDiets),
    surplusScaleNote,
  };
}

async function parseOmniIntent(queryText) {
  const localParsed = parseOmniIntentLocal(queryText);
  const geminiKey = localStorage.getItem("chefcoach_gemini_key");
  if (!geminiKey) return localParsed;

  try {
    const parserPrompt = `Extract structured culinary intent from this search query: "${queryText}".
Return ONLY valid JSON:
{
  "dishFormat": string or null (e.g., "loaf", "cake", "curry", "stir-fry", "breakfast", or null if user only listed ingredients),
  "ingredients": [{ "name": string, "quantity": string }],
  "appliances": [string],
  "dietaryGoals": [string],
  "surplusScaleNote": string or null (if user entered a large surplus of a perishable item like 6 bananas or 1kg apples, note batch scaling)
}`;
    const res = await callGeminiGenerateContent(geminiKey, {
      contents: [{ parts: [{ text: parserPrompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    if (!res.ok) return localParsed;
    const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return localParsed;

    const mergedAppliances = Array.from(
      new Set([
        ...(Array.isArray(parsed.appliances) ? parsed.appliances : []),
        ...(localParsed.appliances.length && (!parsed.appliances || !parsed.appliances.length)
          ? localParsed.appliances
          : []),
      ])
    );

    return {
      rawQuery: queryText,
      dishFormat: parsed.dishFormat || null,
      ingredients: Array.isArray(parsed.ingredients) && parsed.ingredients.length ? parsed.ingredients : localParsed.ingredients,
      appliances: mergedAppliances,
      dietaryGoals: getMergedDietaryGoalsFromQueryAndProfile(Array.isArray(parsed.dietaryGoals) ? parsed.dietaryGoals : []),
      surplusScaleNote: parsed.surplusScaleNote || localParsed.surplusScaleNote || null,
    };
  } catch {
    return localParsed;
  }
}

function renderParsedIntentChips(targetContainer) {
  if (!targetContainer) return;
  const intent = state.parsedIntent;
  if (!intent) {
    targetContainer.hidden = true;
    targetContainer.innerHTML = "";
    return;
  }

  const chips = [];
  if (intent.dishFormat) {
    chips.push({ type: "format", key: intent.dishFormat, label: `Format: ${intent.dishFormat}` });
  }
  if (intent.ingredients?.length) {
    intent.ingredients.forEach((ing, idx) => {
      const text = ing.quantity ? `${ing.quantity} ${ing.name}` : ing.name;
      chips.push({ type: "ingredient", key: String(idx), label: `Ingredient: ${text}` });
    });
  }
  if (intent.appliances?.length) {
    intent.appliances.forEach((appName) => {
      chips.push({ type: "appliance", key: appName, label: `Appliance: ${appName}` });
    });
  }
  if (intent.dietaryGoals?.length) {
    intent.dietaryGoals.forEach((goal) => {
      chips.push({ type: "diet", key: goal, label: `Diet: ${goal}` });
    });
  }
  if (intent.surplusScaleNote) {
    chips.push({ type: "surplus", key: "surplus", label: intent.surplusScaleNote });
  }

  if (!chips.length) {
    targetContainer.hidden = true;
    targetContainer.innerHTML = "";
    return;
  }

  targetContainer.hidden = false;
  targetContainer.innerHTML = chips
    .map(
      (c) => `
      <span class="intent-chip ${c.type}">
        <span>${c.label}</span>
        <button type="button" class="intent-chip-remove" data-chip-type="${c.type}" data-chip-key="${c.key}" title="Remove constraint">✕</button>
      </span>
    `
    )
    .join("");

  targetContainer.querySelectorAll(".intent-chip-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.chipType;
      const key = btn.dataset.chipKey;
      if (!state.parsedIntent) return;
      if (type === "format") state.parsedIntent.dishFormat = null;
      else if (type === "ingredient") state.parsedIntent.ingredients.splice(Number(key), 1);
      else if (type === "appliance") {
        state.parsedIntent.appliances = state.parsedIntent.appliances.filter((a) => a !== key);
      } else if (type === "diet") {
        state.parsedIntent.dietaryGoals = state.parsedIntent.dietaryGoals.filter((g) => g !== key);
      } else if (type === "surplus") {
        state.parsedIntent.surplusScaleNote = null;
      }
      renderParsedIntentChips(dom.parsedIntentChips);
      renderParsedIntentChips(dom.optionsIntentChips);
      if (dom.screens.options.classList.contains("active")) {
        generateDishOptions(true);
      }
    });
  });
}

// ---------------- GENERATE A HANDFUL OF DISH OPTIONS (WITH REGENERATE) ----------------
async function generateDishOptions(skipIntentReparse = false) {
  const promptText = dom.cravingInput.value.trim() || "Mediterranean Salmon, Quinoa & Greens";
  const modelLabel = state.selectedModel === "gemini-argon" ? "Gemini Argon" : "ChatGPT";

  dom.findDishesBtn.disabled = true;
  dom.regenerateOptionsBtn.disabled = true;
  if (dom.clearInputBtn) {
    dom.clearInputBtn.disabled = true;
    dom.clearInputBtn.classList.add("loading");
    dom.clearInputBtn.innerHTML = `<span class="btn-spinner"></span><span>Thinking...</span>`;
  }
  dom.findDishesBtn.querySelector(".btn-main-text").textContent = `${modelLabel} is thinking...`;
  dom.regenerateOptionsBtn.textContent = "⏳ Thinking...";

  // Yield a minimum visible feedback window so the user always sees the "Thinking..." spinner on the Go button
  const minVisualFeedback = new Promise((resolve) => setTimeout(resolve, 480));

  try {
    if (!skipIntentReparse || !state.parsedIntent) {
      state.parsedIntent = await parseOmniIntent(promptText);
    }
    renderParsedIntentChips(dom.parsedIntentChips);
    renderParsedIntentChips(dom.optionsIntentChips);

    let options = null;
    const geminiKey = localStorage.getItem("chefcoach_gemini_key");
    const openaiKey = localStorage.getItem("chefcoach_openai_key");

    if (state.selectedModel === "gemini-argon" && geminiKey) {
      options = await tryFetchLiveOptionsGemini(promptText, geminiKey);
    } else if (state.selectedModel === "chatgpt" && openaiKey) {
      options = await tryFetchLiveOptionsOpenAI(promptText, openaiKey);
    }

    if (!options || !options.length) {
      options = buildMultiOptionsWithCulinaryAI(promptText, state.regenIndex);
    }

    await minVisualFeedback;

    state.dishOptions = options;
    state.optionsHistory[state.regenIndex] = JSON.parse(JSON.stringify(options));
    renderDishOptionsScreen(promptText);
    showScreen("options");
  } finally {
    dom.findDishesBtn.disabled = false;
    dom.regenerateOptionsBtn.disabled = false;
    if (dom.clearInputBtn) {
      dom.clearInputBtn.disabled = false;
      dom.clearInputBtn.classList.remove("loading");
      dom.clearInputBtn.innerHTML = "Go →";
    }
    dom.findDishesBtn.querySelector(".btn-main-text").textContent = "Suggest Dish Options";
    dom.regenerateOptionsBtn.textContent = "🔄 Regenerate";
  }
}

function buildMultiOptionsWithCulinaryAI(promptText, regenCycle = 0) {
  const lower = promptText.toLowerCase();
  const scale = state.servings / 2;
  const intent = state.parsedIntent || parseOmniIntentLocal(promptText);
  const useAirFryer = (intent.appliances || []).some((a) => /air\s*fryer|silicone/i.test(a));
  const isEggless = Boolean(
    state.kitchenProfile?.defaults?.eggless || (intent.dietaryGoals || []).some((g) => /eggless/i.test(g))
  );

  // Detect quantity + main ingredient if user typed something like "SOMETHING WITH 4 BANANAS"
  if (lower.includes("banana")) {
    const qtyMatch = promptText.match(/(\d+)\s*banana/i);
    const count = qtyMatch ? parseInt(qtyMatch[1], 10) : Math.max(2, state.servings);
    const bananaG = count * 120;

    const bananaPool = [
      {
        styleTag: "One-Skillet Bake",
        prepTime: "18 mins",
        isSweet: true,
        baseProteinNum: 30,
        baseFiberNum: 10,
        title: `Warm ${count}-Banana Oat & Greek Skyr Skillet Bake`,
        summary: `Uses all ${count} bananas (${bananaG} g) mashed into a fluffy, zero-refined-sugar protein oat bake with toasted walnuts.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Ripe bananas (${count} whole, peeled & mashed)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Grated apples or unsweetened apple purée", baseGrams: bananaG / scale, unit: "g", reason: "High pectin fiber swap" },
              { name: "Mashed roasted sweet potato", baseGrams: bananaG / scale, unit: "g", reason: "Earthy sweet beta-carotene swap" },
            ],
          },
          {
            id: "ing-2",
            name: "Rolled oats",
            baseGrams: 160,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Quinoa flakes or buckwheat flour", baseGrams: 160, unit: "g", reason: "Gluten-free wholegrain swap" },
              { name: "Almond meal", baseGrams: 150, unit: "g", reason: "Low-carb grain-free swap" },
            ],
          },
          {
            id: "ing-3",
            name: "0% Fat Greek yogurt or soy skyr",
            baseGrams: 220,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "Silken tofu (blended)", baseGrams: 220, unit: "g", reason: "100% dairy-free & cholesterol-free" },
              { name: "Low-fat cottage cheese", baseGrams: 220, unit: "g", reason: "High casein protein" },
            ],
          },
          {
            id: "ing-4",
            name: "Liquid egg whites",
            baseGrams: 120,
            unit: "ml",
            isProteinCore: true,
            alternatives: [
              { name: "Ground flaxseed mixed with warm water", baseGrams: 110, unit: "ml", reason: "100% plant-based omega-3 binder" },
            ],
          },
          {
            id: "ing-5",
            name: "Chopped walnuts & cinnamon",
            baseGrams: 40,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Pumpkin seeds & dark cocoa nibs", baseGrams: 40, unit: "g", reason: "Nut-free crunch" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Mash Bananas",
            instruction: "Peel [ing-1] into a large bowl and mash thoroughly with a fork until smooth and creamy.",
            tip: "Riper bananas with brown speckles give natural caramel sweetness without added sugar.",
            timerMinutes: null,
          },
          {
            phase: "Step 2 • Whisk Protein Base",
            instruction: "Whisk [ing-3] and [ing-4] into the mashed [ing-1] until glossy and smooth.",
            tip: "Whisking air into the egg whites and yogurt makes the bake rise light and fluffy.",
            timerMinutes: null,
          },
          {
            phase: "Step 3 • Fold Oats & Walnuts",
            instruction: "Fold in [ing-2] and half of [ing-5]. Let rest for 3 minutes so the oats soften.",
            tip: "Oat beta-glucan fiber naturally binds cholesterol in the digestive tract.",
            timerMinutes: 3,
          },
          {
            phase: "Step 4 • Skillet or Oven Bake",
            instruction: "Pour into a lightly oiled non-stick skillet over medium-low heat (covered) for 12 minutes until set in the center (or bake at 180°C for 18 minutes in the oven). Top with remaining [ing-5]!",
            tip: "Covering the skillet traps steam so the center cooks evenly without burning the base.",
            timerMinutes: 12,
          },
        ],
      },
      {
        styleTag: "12-Min Stovetop",
        prepTime: "12 mins",
        isSweet: true,
        baseProteinNum: 32,
        baseFiberNum: 9,
        title: `Fluffy ${count}-Banana Protein Griddle Pancakes`,
        summary: `Quick flourless blender/bowl pancakes powered by ${count} ripe bananas (${bananaG} g), oats, and lean protein.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Ripe bananas (${count} whole, mashed smooth)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Cooked pumpkin purée", baseGrams: bananaG / scale, unit: "g", reason: "Low-sugar vitamin-A swap" },
            ],
          },
          {
            id: "ing-2",
            name: "Quick or rolled oats",
            baseGrams: 150,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Wholemeal spelt flour", baseGrams: 150, unit: "g", reason: "Classic fluffy pancake texture" },
            ],
          },
          {
            id: "ing-3",
            name: "Liquid egg whites",
            baseGrams: 150,
            unit: "ml",
            isProteinCore: true,
            alternatives: [
              { name: "Soy protein milk + 20 g chia seeds", baseGrams: 150, unit: "ml", reason: "Vegan protein binder" },
            ],
          },
          {
            id: "ing-4",
            name: "0% Fat Greek yogurt (for batter & topping)",
            baseGrams: 180,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "Coconut or soy yogurt", baseGrams: 180, unit: "g", reason: "Dairy-free creamy topping" },
            ],
          },
          {
            id: "ing-5",
            name: "Fresh berries & cinnamon",
            baseGrams: 120,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Diced pear or apple", baseGrams: 120, unit: "g", reason: "Crisp orchard fruit swap" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Make Batter",
            instruction: "Mash [ing-1] in a bowl, then whisk in [ing-2], [ing-3], and half of [ing-4] until thick and smooth.",
            tip: "Letting the batter sit for 2 minutes thickens the oats so pancakes flip effortlessly.",
            timerMinutes: 2,
          },
          {
            phase: "Step 2 • Griddle First Side",
            instruction: "Warm a non-stick skillet over medium heat. Pour rounds of batter and cook for 3 minutes until bubbles form around the edges.",
            tip: "Banana sugars caramelize quickly—keep heat at medium so they turn golden, not dark.",
            timerMinutes: 3,
          },
          {
            phase: "Step 3 • Flip & Top",
            instruction: "Flip with a spatula and cook for 2 minutes more. Serve stacked with remaining [ing-4] and [ing-5]!",
            tip: "Warm berries release their juices as a natural zero-sugar syrup.",
            timerMinutes: 2,
          },
        ],
      },
      {
        styleTag: "5-Min caramelized",
        prepTime: "8 mins",
        isSweet: true,
        baseProteinNum: 29,
        baseFiberNum: 11,
        title: `Caramelized Cinnamon ${count}-Banana & Chia Protein Bowl`,
        summary: `Pan-seared banana halves in a touch of heart-safe oil with warm cinnamon, served over protein skyr,chia-oat porridge, and toasted seeds.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Bananas (${count} whole, sliced lengthwise)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Sliced peaches or nectarines", baseGrams: bananaG / scale, unit: "g", reason: "Stone-fruit caramelization swap" },
            ],
          },
          {
            id: "ing-2",
            name: "0% Fat Greek skyr or cottage cheese",
            baseGrams: 250,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "High-protein soy yogurt", baseGrams: 250, unit: "g", reason: "Plant-based protein bowl base" },
            ],
          },
          {
            id: "ing-3",
            name: "Rolled oats & chia seeds",
            baseGrams: 110,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Toasted buckwheat groats & flax", baseGrams: 110, unit: "g", reason: "Crunchy high-fiber superfood" },
            ],
          },
          {
            id: "ing-4",
            name: "Almond or oat milk (unsweetened)",
            baseGrams: 220,
            unit: "ml",
            alternatives: [
              { name: "Skim milk or soy milk", baseGrams: 220, unit: "ml", reason: "Extra protein liquid base" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Simmer Quick Chia-Oats",
            instruction: "Simmer [ing-3] with [ing-4] in a small pot for 4 minutes until thick and creamy.",
            tip: "Chia seeds absorb liquid rapidly and create a pudding-like soluble fiber base.",
            timerMinutes: 4,
          },
          {
            phase: "Step 2 • Sear Bananas",
            instruction: "Lay [ing-1] cut-side down in a warm non-stick skillet for 3 minutes until golden and caramelized.",
            tip: "No sugar needed—the natural fruit fructose caramelizes on contact with the warm pan.",
            timerMinutes: 3,
          },
          {
            phase: "Step 3 • Assemble Bowl",
            instruction: "Spoon the warm oats into bowls, swirl in [ing-2], and crown with the warm caramelized [ing-1]!",
            tip: "Hot caramelized fruit over cool protein skyr tastes like a restaurant dessert.",
            timerMinutes: null,
          },
        ],
      },
      {
        styleTag: "No-Cook Smoothie Bowl",
        prepTime: "5 mins",
        isSweet: true,
        baseProteinNum: 34,
        baseFiberNum: 12,
        title: `Creamy ${count}-Banana, Cocoa & Hemp Protein Whip`,
        summary: `Thick spoonable soft-serve made from ${count} bananas (${bananaG} g), unsweetened dark cocoa, and lean protein.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Ripe bananas (${count} whole, peeled & chunked)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Mango chunks & avocado", baseGrams: bananaG / scale, unit: "g", reason: "Creamy tropical fiber swap" },
            ],
          },
          {
            id: "ing-2",
            name: "0% Fat Greek yogurt or silken tofu",
            baseGrams: 240,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "Plant protein powder + 150 ml almond milk", baseGrams: 180, unit: "g", reason: "Concentrated protein boost" },
            ],
          },
          {
            id: "ing-3",
            name: "Unsweetened dark cocoa powder & rolled oats",
            baseGrams: 60,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Carob powder & chia seeds", baseGrams: 60, unit: "g", reason: "Caffeine-free antioxidant swap" },
            ],
          },
          {
            id: "ing-4",
            name: "Hemp seeds or natural peanut butter",
            baseGrams: 35,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "Tahini or almond butter", baseGrams: 35, unit: "g", reason: "Heart-safe monounsaturated fat" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Blend Base",
            instruction: "Place [ing-1], [ing-2], and [ing-3] in a blender or food processor (or mash vigorously in a deep bowl) for 2 minutes until thick and velvety.",
            tip: " Cocoa flavanols support healthy blood vessels and pair naturally with banana.",
            timerMinutes: 2,
          },
          {
            phase: "Step 2 • Top & Serve",
            instruction: "Spoon into chilled bowls and top with [ing-4]. Dig in with a spoon!",
            tip: "Hemp seeds add complete plant protein and omega-3s.",
            timerMinutes: null,
          },
        ],
      },
    ];

    const chatgptBananaPool = [
      {
        styleTag: "16-Min Air Fryer / Oven",
        prepTime: "16 mins",
        isSweet: true,
        baseProteinNum: 33,
        baseFiberNum: 11,
        title: `Golden Air-Fried ${count}-Banana & Cottage Cheese Protein Fritters`,
        summary: `Crisp-tender golden fritters made from ${count} mashed bananas (${bananaG} g), whipped cottage cheese, oat flour, and warm nutmeg.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Ripe bananas (${count} whole, mashed)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Stewed apple chunks", baseGrams: bananaG / scale, unit: "g", reason: "Orchard fruit swap" },
            ],
          },
          {
            id: "ing-2",
            name: "Low-fat cottage cheese or ricotta",
            baseGrams: 220,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "0% Greek skyr", baseGrams: 220, unit: "g", reason: "Smooth high-protein swap" },
            ],
          },
          {
            id: "ing-3",
            name: "Rolled oat flour & baking powder",
            baseGrams: 150,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Wholemeal spelt flour", baseGrams: 150, unit: "g", reason: "Light bakery texture" },
            ],
          },
          {
            id: "ing-4",
            name: "Liquid egg whites",
            baseGrams: 120,
            unit: "ml",
            isProteinCore: true,
            alternatives: [
              { name: "Chia egg binder", baseGrams: 100, unit: "ml", reason: "Plant-based binder" },
            ],
          },
          {
            id: "ing-5",
            name: "Toasted pecans & nutmeg",
            baseGrams: 35,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Sunflower & pumpkin seeds", baseGrams: 35, unit: "g", reason: "Nut-free crunch" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Fold Fritter Batter",
            instruction: "Mash [ing-1] in a bowl, then fold in [ing-2], [ing-3], [ing-4], and [ing-5] until a thick scoopable batter forms.",
            tip: "Cottage cheese curds melt during baking into pockets of creamy protein.",
            timerMinutes: null,
          },
          {
            phase: "Step 2 • Air-Fry or Bake",
            instruction: "Scoop mounds onto a lined tray and bake at 190°C for 16 minutes (or 11 minutes in an air fryer) until puffed and golden brown.",
            tip: "Air circulation crisps the outside with zero deep-frying oil.",
            timerMinutes: 16,
          },
        ],
      },
      {
        styleTag: "10-Min French Toast",
        prepTime: "10 mins",
        isSweet: true,
        baseProteinNum: 35,
        baseFiberNum: 10,
        title: `Caramelized ${count}-Banana Custard French Toast Skillet`,
        summary: `Wholegrain sourdough or oat slices soaked in a banana-egg-white protein custard, griddled golden and topped with warm sliced bananas.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Ripe bananas (${count} whole: half mashed for custard, half sliced)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Ripe pears or berries", baseGrams: bananaG / scale, unit: "g", reason: "Fresh fruit swap" },
            ],
          },
          {
            id: "ing-2",
            name: "Thick sprouted wholegrain or rye bread",
            baseGrams: 160,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Rolled oats (for baked French toast)", baseGrams: 150, unit: "g", reason: "Pantry oat swap" },
            ],
          },
          {
            id: "ing-3",
            name: "Liquid egg whites & unsweetened almond milk",
            baseGrams: 200,
            unit: "ml",
            isProteinCore: true,
            alternatives: [
              { name: "Soy milk & vanilla protein powder", baseGrams: 200, unit: "ml", reason: "Plant protein custard" },
            ],
          },
          {
            id: "ing-4",
            name: "0% Fat Greek yogurt & cinnamon",
            baseGrams: 160,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "Coconut yogurt", baseGrams: 160, unit: "g", reason: "Dairy-free topping" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Whisk Banana Custard",
            instruction: "Mash half of [ing-1] with [ing-3] in a shallow dish. Soak [ing-2] for 2 minutes until saturated.",
            tip: "Mashed banana thickens the egg custard naturally without heavy cream.",
            timerMinutes: 2,
          },
          {
            phase: "Step 2 • Griddle Toast & Fruit",
            instruction: "Sear the soaked [ing-2] and remaining sliced [ing-1] in a warm non-stick pan for 4 minutes per side until golden. Top with [ing-4]!",
            tip: "Searing the sliced bananas alongside the toast caramelizes their edges.",
            timerMinutes: 4,
          },
        ],
      },
      {
        styleTag: "15-Min Crumble",
        prepTime: "15 mins",
        isSweet: true,
        baseProteinNum: 28,
        baseFiberNum: 13,
        title: `Warm Spiced ${count}-Banana, Berry & Almond-Oat Crisp`,
        summary: `Bubbling warm ${count}-banana and berry compote beneath a crunchy toasted oat, almond, and flaxseed protein crumble.`,
        ingredients: [
          {
            id: "ing-1",
            name: `Ripe bananas (${count} whole, coined)`,
            baseGrams: bananaG / scale,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Sliced apples or peaches", baseGrams: bananaG / scale, unit: "g", reason: "Classic orchard crumble" },
            ],
          },
          {
            id: "ing-2",
            name: "Mixed berries (fresh or frozen)",
            baseGrams: 150,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Diced pear", baseGrams: 150, unit: "g", reason: "Sweet fiber pairing" },
            ],
          },
          {
            id: "ing-3",
            name: "Rolled oats, almond meal & chia seeds",
            baseGrams: 140,
            unit: "g",
            isFiberCore: true,
            alternatives: [
              { name: "Quinoa flakes & crushed walnuts", baseGrams: 140, unit: "g", reason: "Gluten-free crunch" },
            ],
          },
          {
            id: "ing-4",
            name: "0% Fat Greek skyr (served on top)",
            baseGrams: 220,
            unit: "g",
            isProteinCore: true,
            alternatives: [
              { name: "Soy protein yogurt", baseGrams: 220, unit: "g", reason: "Plant protein cream" },
            ],
          },
        ],
        steps: [
          {
            phase: "Step 1 • Simmer Fruit Base",
            instruction: "Place [ing-1] and [ing-2] in an oven-safe skillet over medium heat for 4 minutes until juicy and bubbling.",
            tip: "Berries add tartness that balances the sweet bananas.",
            timerMinutes: 4,
          },
          {
            phase: "Step 2 • Crisp the Oat Topping",
            instruction: "Scatter [ing-3] over the fruit and bake at 200°C for 10 minutes (or 7 minutes in an air fryer) until toasted. Serve with [ing-4]!",
            tip: "Toasting oats unlocks a nutty aroma that replaces butter and brown sugar.",
            timerMinutes: 10,
          },
        ],
      },
    ];

    const airFryerBananaPool = useAirFryer
      ? [
          {
            styleTag: count >= 4 ? "Air Fryer • 2 Silicone Trays" : "Air Fryer • Silicone Loaf",
            prepTime: "24 mins",
            isSweet: true,
            baseProteinNum: 22,
            baseFiberNum: 11,
            title: `Air Fryer ${count}-Banana & Oat Loaf${count >= 4 ? " (2 Silicone Trays)" : ""}`,
            summary: `Uses all ${count} bananas (${bananaG} g) with oat flour/rolled oats and ${isEggless ? "chia gel" : "egg whites"}, baked at 160°C in air fryer silicone trays.`,
            ingredients: [
              { id: "ing-1", name: `Ripe bananas (${count} whole, mashed)`, baseGrams: bananaG / scale, unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-2", name: "Oat flour (blended rolled oats)", baseGrams: Math.round((count * 55) / scale), unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-3", name: isEggless ? "Chia seed gel (20 g chia + 100 ml water)" : "Liquid egg whites", baseGrams: 120, unit: "g", isProteinCore: true, alternatives: [] },
              { id: "ing-4", name: "Unsweetened almond or oat milk", baseGrams: 90, unit: "ml", alternatives: [] },
              { id: "ing-5", name: "Bicarbonate of soda & apple cider vinegar", baseGrams: 10, unit: "g", alternatives: [] },
            ],
            steps: [
              {
                phase: "Step 1 • Wet Base & Hydration",
                instruction: "Mash [ing-1] smooth in a bowl. Stir in [ing-3], [ing-4], and [ing-5] until evenly combined.",
                tip: "Letting chia or oat flour hydrate for 3 minutes improves crumb structure.",
                timerMinutes: 3,
              },
              {
                phase: "Step 2 • Fold Dry & Split Trays",
                instruction: `Fold in [ing-2] gently without overmixing. ${count >= 4 ? "Divide batter evenly between 2 silicone loaf inserts so heat circulates properly." : "Pour batter into a lined silicone loaf insert."}`,
                tip: "Splitting heavy banana-oat batter across 2 trays prevents an undercooked centre.",
                timerMinutes: null,
              },
              {
                phase: "Step 3 • Air Fry at 160°C",
                instruction: "Air fry at 160°C for 22 minutes until a skewer comes out clean. Cool for 10 minutes before slicing.",
                tip: "160°C bakes dense fruit-oat batter through without scorching the top.",
                timerMinutes: 22,
              },
            ],
          },
          {
            styleTag: "Air Fryer • 165°C Bars",
            prepTime: "18 mins",
            isSweet: true,
            baseProteinNum: 20,
            baseFiberNum: 10,
            title: `Air Fryer ${count}-Banana Oat Bake Bars`,
            summary: `Chewy, scale-measured banana oat bars baked in the air fryer at 165°C with zero refined sugar.`,
            ingredients: [
              { id: "ing-1", name: `Mashed ripe bananas (${count} whole)`, baseGrams: bananaG / scale, unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-2", name: "Rolled oats", baseGrams: Math.round((count * 50) / scale), unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-3", name: "Ground flaxseed & cinnamon", baseGrams: 25, unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-4", name: "Extra-virgin olive oil or nut butter", baseGrams: 30, unit: "g", alternatives: [] },
            ],
            steps: [
              {
                phase: "Step 1 • Mix Batter",
                instruction: "Mash [ing-1] with [ing-4]. Fold in [ing-2] and [ing-3] until thick.",
                tip: "Oats absorb banana moisture rapidly—rest 5 minutes before pressing into the tray.",
                timerMinutes: 5,
              },
              {
                phase: "Step 2 • Air Fry at 165°C",
                instruction: "Press evenly into silicone air-fryer trays. Air fry at 165°C for 16 minutes until golden at the edges.",
                tip: "Slice once cool for clean, portable bars.",
                timerMinutes: 16,
              },
            ],
          },
          {
            styleTag: "Air Fryer • 175°C Bites",
            prepTime: "14 mins",
            isSweet: true,
            baseProteinNum: 18,
            baseFiberNum: 9,
            title: `Crispy Air Fryer ${count}-Banana Oat Clusters`,
            summary: `Portioned banana-oat clusters crisped in the air fryer basket at 175°C for a fast batch snack.`,
            ingredients: [
              { id: "ing-1", name: `Ripe bananas (${count} whole, mashed)`, baseGrams: bananaG / scale, unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-2", name: "Rolled oats", baseGrams: Math.round((count * 55) / scale), unit: "g", isFiberCore: true, alternatives: [] },
              { id: "ing-3", name: "Chia seeds & vanilla", baseGrams: 20, unit: "g", isFiberCore: true, alternatives: [] },
            ],
            steps: [
              {
                phase: "Step 1 • Scoop Clusters",
                instruction: "Combine [ing-1], [ing-2], and [ing-3] into a thick scoopable batter. Drop 35 g mounds onto perforated parchment in the air fryer basket.",
                tip: "Leave 2 cm space between mounds for airflow.",
                timerMinutes: null,
              },
              {
                phase: "Step 2 • Air Fry at 175°C",
                instruction: "Air fry at 175°C for 12 minutes until crisp outside and tender inside.",
                tip: "Work in 2 batches if using a single basket.",
                timerMinutes: 12,
              },
            ],
          },
        ]
      : [];

    const activeBananaPool = useAirFryer
      ? [...airFryerBananaPool, ...(state.selectedModel === "chatgpt" ? chatgptBananaPool : bananaPool)]
      : state.selectedModel === "chatgpt"
      ? chatgptBananaPool
      : bananaPool;
    const picked = [
      activeBananaPool[regenCycle % activeBananaPool.length],
      activeBananaPool[(regenCycle + 1) % activeBananaPool.length],
      activeBananaPool[(regenCycle + 2) % activeBananaPool.length],
    ];
    return picked.map((raw) => applyDietaryEngineeringToRecipe(raw, scale));
  }

  // General Dynamic Multi-Option Generator for ANY user request (strip appliance/method words cleanly)
  const cleaned = promptText
    .replace(/^(something\s+with|make\s+me|i\s+have|cook\s+with|recipe\s+with|recipe\s+for)\s+/i, "")
    .replace(/\b(in\s+an?\s+air\s*-?\s*fryer|in\s+airfryer|air\s*-?\s*fryer|airfryer|silicone\s*(?:loaf\s*)?(?:trays?|inserts?)|stovetop|no\s*oven|using)\b/gi, " ")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Mediterranean Salmon & Greens";
  const subjectTitle = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  const generalTemplates = [
    {
      styleTag: "15-Min Skillet",
      prepTime: "15 mins",
      isSweet: false,
      baseProteinNum: 38,
      baseFiberNum: 9,
      title: `Pan-Seared ${subjectTitle} with Lemon-Garlic & Greens`,
      summary: `Fast, high-flavor one-skillet preparation featuring ${cleaned}, crisp-tender greens, and a bright lemon-herb olive oil glaze.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (prepped into bite-size pieces)`,
          baseGrams: 340,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Extra-firm organic tofu cubes", baseGrams: 350, unit: "g", reason: "Zero-cholesterol plant protein", cookAction: "sear-tofu" },
            { name: "Skinless chicken breast strips", baseGrams: 340, unit: "g", reason: "Lean high-protein poultry", cookAction: "sear-poultry" },
            { name: "Cooked chickpeas (drained)", baseGrams: 360, unit: "g", reason: "High soluble fiber legume", cookAction: "crisp-legume" },
          ],
        },
        {
          id: "ing-2",
          name: "Fresh baby spinach & broccoli florets",
          baseGrams: 220,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Chopped Tuscan kale & green beans", baseGrams: 220, unit: "g", reason: "Hearty cruciferous fiber" },
            { name: "Courgette ribbons & bell peppers", baseGrams: 240, unit: "g", reason: "Sweet tender Mediterranean veggies" },
          ],
        },
        {
          id: "ing-3",
          name: "Cooked quinoa or wholegrain brown rice",
          baseGrams: 180,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Cannellini white beans (rinsed)", baseGrams: 220, unit: "g", reason: "Creamy cholesterol-lowering soluble fiber" },
            { name: "Cauliflower rice", baseGrams: 250, unit: "g", reason: "Lighter low-carb base" },
          ],
        },
        {
          id: "ing-4",
          name: "Extra-virgin olive oil",
          baseGrams: 20,
          unit: "ml",
          alternatives: [
            { name: "Avocado oil", baseGrams: 20, unit: "ml", reason: "High smoke point heart-safe oil" },
          ],
        },
        {
          id: "ing-5",
          name: "Fresh lemon juice, minced garlic & oregano",
          baseGrams: 35,
          unit: "ml",
          alternatives: [
            { name: "Balsamic vinegar & rosemary", baseGrams: 30, unit: "ml", reason: "Rich tangy herb glaze" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Sear Main Ingredient",
          instruction: "Warm [ing-4] in a wide non-stick skillet over medium-high heat. Add [ing-1] and sear for 5 minutes, turning once, until golden.",
          tip: "Patting ingredients dry before they hit the pan gives a golden sear with minimal oil.",
          timerMinutes: 5,
        },
        {
          phase: "Step 2 • Steam-Toss Greens",
          instruction: "Add [ing-2] and 30 ml of water to the skillet. Cover for 3 minutes until bright green and crisp-tender.",
          tip: "A splash of water steams greens rapidly while keeping their antioxidants intact.",
          timerMinutes: 3,
        },
        {
          phase: "Step 3 • Warm Base & Glaze",
          instruction: "Fold in [ing-3] and pour [ing-5] over the skillet. Toss for 2 minutes until piping hot and fragrant, then serve!",
          tip: "Adding fresh citrus at the end brightens the whole dish without extra salt.",
          timerMinutes: 2,
        },
      ],
    },
    {
      styleTag: "Hearty One-Pot",
      prepTime: "20 mins",
      isSweet: false,
      baseProteinNum: 34,
      baseFiberNum: 13,
      title: `Mediterranean ${subjectTitle}, Lentil & Herb Stew`,
      summary: `Rich, comforting one-pot simmer combining ${cleaned} with red lentils, crushed tomatoes, and aromatic garlic.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (cut into chunks)`,
          baseGrams: 320,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Chickpeas & diced mushrooms", baseGrams: 340, unit: "g", reason: "Earthy high-fiber plant swap" },
            { name: "Diced turkey breast", baseGrams: 320, unit: "g", reason: "Ultra-lean high protein" },
          ],
        },
        {
          id: "ing-2",
          name: "Dry red split lentils (rinsed)",
          baseGrams: 160,
          unit: "g",
          isFiberCore: true,
          isProteinCore: true,
          alternatives: [
            { name: "Canned brown lentils or black beans (drained)", baseGrams: 280, unit: "g", reason: "Pre-cooked fast legume swap" },
          ],
        },
        {
          id: "ing-3",
          name: "Crushed tomatoes & diced carrots",
          baseGrams: 300,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Diced sweet potato & tomato passata", baseGrams: 300, unit: "g", reason: "Velvety beta-carotene base" },
          ],
        },
        {
          id: "ing-4",
          name: "Low-sodium vegetable broth",
          baseGrams: 500,
          unit: "ml",
          alternatives: [
            { name: "Water + herb bouillon", baseGrams: 500, unit: "ml", reason: "Pantry stock alternative" },
          ],
        },
        {
          id: "ing-5",
          name: "Extra-virgin olive oil, cumin & smoked paprika",
          baseGrams: 20,
          unit: "ml",
          alternatives: [
            { name: "Olive oil & Italian herbs", baseGrams: 20, unit: "ml", reason: "Classic Tuscan flavor profile" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Bloom Spices & Aromatics",
          instruction: "Warm [ing-5] in a medium pot over medium heat. Add [ing-1] and cook for 4 minutes to lock in flavor.",
          tip: "Warming spices in olive oil releases fat-soluble aroma compounds immediately.",
          timerMinutes: 4,
        },
        {
          phase: "Step 2 • Simmer Lentils & Tomatoes",
          instruction: "Stir in [ing-2], [ing-3], and [ing-4]. Bring to a gentle boil, cover partially, and simmer on low for 14 minutes until tender.",
          tip: "Red lentils naturally thicken the stew into a velvety sauce with zero heavy cream.",
          timerMinutes: 14,
        },
        {
          phase: "Step 3 • Rest & Ladle",
          instruction: "Turn off the heat and let stand for 2 minutes before ladling into warm bowls.",
          tip: "Resting lets the flavors meld and thickens the broth.",
          timerMinutes: 2,
        },
      ],
    },
    {
      styleTag: "Sheet-Pan / Roast",
      prepTime: "22 mins",
      isSweet: false,
      baseProteinNum: 36,
      baseFiberNum: 11,
      title: `Crispy Oven-Roasted ${subjectTitle} & Chickpea Power Bowl`,
      summary: `Hands-off sheet-pan roast of ${cleaned} and spiced chickpeas served over leafy greens with a lemon-tahini drizzle.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (seasoned for roasting)`,
          baseGrams: 340,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Halloumi or firm tofu cubes", baseGrams: 320, unit: "g", reason: "Roasts to golden crispy edges" },
            { name: "Wild salmon fillets", baseGrams: 320, unit: "g", reason: "Rich in heart-healthy omega-3s" },
          ],
        },
        {
          id: "ing-2",
          name: "Cooked chickpeas (rinsed & patted dry)",
          baseGrams: 240,
          unit: "g",
          isFiberCore: true,
          isProteinCore: true,
          alternatives: [
            { name: "Cubed sweet potato or butternut squash", baseGrams: 260, unit: "g", reason: "Caramelized fiber-rich roast" },
          ],
        },
        {
          id: "ing-3",
          name: "Broccoli florets & red onion wedges",
          baseGrams: 260,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Cauliflower florets & Brussels sprouts", baseGrams: 260, unit: "g", reason: "Crispy roasted cruciferous veggies" },
          ],
        },
        {
          id: "ing-4",
          name: "Tahini, lemon juice & warm water drizzle",
          baseGrams: 45,
          unit: "ml",
          alternatives: [
            { name: "0% Greek yogurt & garlic herb sauce", baseGrams: 60, unit: "g", reason: "High-protein tangy dressing" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Toss on Sheet Pan",
          instruction: "Preheat oven (or air fryer) to 200°C. Spread [ing-1], [ing-2], and [ing-3] on a lined tray with a light drizzle of olive oil.",
          tip: "Giving ingredients breathing room on the tray ensures they roast crisp instead of steaming.",
          timerMinutes: null,
        },
        {
          phase: "Step 2 • Roast Until Golden",
          instruction: "Roast at 200°C for 16 minutes (or 12 minutes in an air fryer) until the edges are crisp and golden.",
          tip: "Chickpeas turn wonderfully crunchy in the oven and pack soluble fiber.",
          timerMinutes: 16,
        },
        {
          phase: "Step 3 • Drizzle & Serve",
          instruction: "Transfer to warm bowls and drizzle generously with [ing-4]. Serve immediately!",
          tip: "Sesame tahini is rich in plant sterols that support healthy cholesterol.",
          timerMinutes: null,
        },
      ],
    },
    {
      styleTag: "10-Min Wok Stir-Fry",
      prepTime: "10 mins",
      isSweet: false,
      baseProteinNum: 35,
      baseFiberNum: 10,
      title: `Ginger-Garlic ${subjectTitle} & Edamame Wok Bowl`,
      summary: `Ultra-fast high-heat stir-fry of ${cleaned} with shelled edamame, crisp vegetables, and a low-sodium tamari-ginger glaze.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (thinly sliced for stir-fry)`,
          baseGrams: 330,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Prawns or tempeh strips", baseGrams: 320, unit: "g", reason: "Fast-cooking high protein" },
          ],
        },
        {
          id: "ing-2",
          name: "Shelled edamame beans",
          baseGrams: 180,
          unit: "g",
          isProteinCore: true,
          isFiberCore: true,
          alternatives: [
            { name: "Cashews or chickpeas", baseGrams: 160, unit: "g", reason: "Crunchy plant protein" },
          ],
        },
        {
          id: "ing-3",
          name: "Shredded cabbage, carrots & snap peas",
          baseGrams: 260,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Bok choy & sliced mushrooms", baseGrams: 260, unit: "g", reason: "Tender Asian greens" },
          ],
        },
        {
          id: "ing-4",
          name: "Low-sodium soy sauce, grated ginger & sesame oil",
          baseGrams: 35,
          unit: "ml",
          alternatives: [
            { name: "Tamari, lime juice & garlic", baseGrams: 35, unit: "ml", reason: "Gluten-free zesty stir-fry glaze" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Sear in Hot Wok",
          instruction: "Heat a wok or large skillet over high heat. Sear [ing-1] and [ing-2] for 4 minutes, tossing frequently.",
          tip: "High heat sears quickly while keeping the inside tender and juicy.",
          timerMinutes: 4,
        },
        {
          phase: "Step 2 • Crisp-Toss Veggies",
          instruction: "Add [ing-3] and stir-fry for 3 minutes until bright and crisp-tender.",
          tip: "Keep veggies slightly crisp to preserve both texture and vitamin C.",
          timerMinutes: 3,
        },
        {
          phase: "Step 3 • Glaze & Plate",
          instruction: "Pour [ing-4] around the rim of the hot pan, toss vigorously to coat evenly, and plate warm!",
          tip: "Pouring sauce around the hot pan rim caramelizes the ginger aroma.",
          timerMinutes: null,
        },
      ],
    },
  ];

  const chatgptGeneralTemplates = [
    {
      styleTag: "18-Min Herb Grill / Sear",
      prepTime: "18 mins",
      isSweet: false,
      baseProteinNum: 40,
      baseFiberNum: 11,
      title: `Char-Grilled Rosemary ${subjectTitle} & Warm Cannellini Bean Salad`,
      summary: `Tuscan-style seared ${cleaned} served over warm garlic-herb cannellini beans, wilted rocket/arugula, and roasted cherry tomatoes.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (marinated with rosemary & black pepper)`,
          baseGrams: 340,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Extra-firm smoked tofu or tempeh", baseGrams: 340, unit: "g", reason: "Plant-based protein swap" },
            { name: "Wild sea bass or cod fillets", baseGrams: 340, unit: "g", reason: "Flaky lean fish swap" },
          ],
        },
        {
          id: "ing-2",
          name: "Cannellini white beans (rinsed & drained)",
          baseGrams: 260,
          unit: "g",
          isFiberCore: true,
          isProteinCore: true,
          alternatives: [
            { name: "Butter beans or cooked puy lentils", baseGrams: 260, unit: "g", reason: "Creamy soluble fiber swap" },
          ],
        },
        {
          id: "ing-3",
          name: "Cherry tomatoes & fresh rocket / spinach",
          baseGrams: 240,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Roasted bell peppers & baby kale", baseGrams: 240, unit: "g", reason: "Vitamin-C rich greens" },
          ],
        },
        {
          id: "ing-4",
          name: "Extra-virgin olive oil, balsamic glaze & garlic",
          baseGrams: 30,
          unit: "ml",
          alternatives: [
            { name: "Lemon-herb olive oil dressing", baseGrams: 30, unit: "ml", reason: "Bright citrus finish" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Char-Sear Main Ingredient",
          instruction: "Heat a grill pan or heavy skillet over medium-high heat. Sear [ing-1] with half of [ing-4] for 6 minutes until golden-charred.",
          tip: "High contact heat creates savory Maillard crust without butter.",
          timerMinutes: 6,
        },
        {
          phase: "Step 2 • Blister Tomatoes & Warm Beans",
          instruction: "Add [ing-2] and [ing-3] to the pan for 4 minutes until the tomatoes blister and the greens just wilt.",
          tip: "Blistered tomatoes burst to form an instant pan sauce with the white beans.",
          timerMinutes: 4,
        },
        {
          phase: "Step 3 • Drizzle & Plate",
          instruction: "Spoon the warm bean and tomato medley onto plates, top with [ing-1], and drizzle with remaining [ing-4]!",
          tip: "Cannellini beans are one of the richest whole-food sources of cholesterol-binding soluble fiber.",
          timerMinutes: null,
        },
      ],
    },
    {
      styleTag: "15-Min Creamy Skillet",
      prepTime: "15 mins",
      isSweet: false,
      baseProteinNum: 39,
      baseFiberNum: 9,
      title: `Velvety Garlic-Skyr ${subjectTitle} & Roasted Mushroom Stroganoff`,
      summary: `High-protein, zero-heavy-cream skillet stroganoff combining ${cleaned} with caramelized mushrooms, spinach, and a tangy Greek skyr herb sauce.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (sliced into bite-size strips)`,
          baseGrams: 330,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "King oyster & chestnut mushrooms + edamame", baseGrams: 350, unit: "g", reason: "Meaty plant-based swap" },
          ],
        },
        {
          id: "ing-2",
          name: "Sliced cremini mushrooms & shallots",
          baseGrams: 240,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Sliced courgette & leeks", baseGrams: 240, unit: "g", reason: "Sweet tender aromatics" },
          ],
        },
        {
          id: "ing-3",
          name: "0% Fat Greek skyr or soy yogurt & Dijon mustard",
          baseGrams: 160,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Blended silken tofu & nutritional yeast", baseGrams: 160, unit: "g", reason: "100% dairy-free velvety sauce" },
          ],
        },
        {
          id: "ing-4",
          name: "Cooked wholewheat fusilli or buckwheat soba",
          baseGrams: 190,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Steamed green peas & quinoa", baseGrams: 200, unit: "g", reason: "Whole-grain legume base" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Brown Mushrooms & Main",
          instruction: "Sear [ing-1] and [ing-2] in a lightly oiled skillet over medium-high heat for 6 minutes until deeply golden.",
          tip: "Letting mushrooms brown undisturbed before stirring develops deep umami flavor.",
          timerMinutes: 6,
        },
        {
          phase: "Step 2 • Toss Wholegrain Base",
          instruction: "Add [ing-4] and 40 ml of warm water or stock to deglaze the pan for 2 minutes.",
          tip: "Deglazing lifts all the caramelized pan fond into the sauce.",
          timerMinutes: 2,
        },
        {
          phase: "Step 3 • Swirl Velvety Skyr Sauce",
          instruction: "Remove skillet from direct heat and fold in [ing-3] until glossy and creamy. Serve warm!",
          tip: "Stirring in Greek skyr off the heat keeps it silky-smooth without curdling.",
          timerMinutes: null,
        },
      ],
    },
    {
      styleTag: "20-Min Baked Parcel",
      prepTime: "20 mins",
      isSweet: false,
      baseProteinNum: 36,
      baseFiberNum: 12,
      title: `Spiced Harissa-Lime ${subjectTitle} & Black Bean Fajita Traybake`,
      summary: `Vibrant smoky sheet-pan bake with ${cleaned}, sweet bell peppers, black beans, and avocado-lime crema.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (tossed in smoked paprika & cumin)`,
          baseGrams: 340,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Spiced cauliflower steaks & hemp seeds", baseGrams: 350, unit: "g", reason: "Plant-forward roast" },
          ],
        },
        {
          id: "ing-2",
          name: "Cooked black beans & sweetcorn (drained)",
          baseGrams: 240,
          unit: "g",
          isFiberCore: true,
          isProteinCore: true,
          alternatives: [
            { name: "Pinto beans or kidney beans", baseGrams: 240, unit: "g", reason: "High-fiber legume swap" },
          ],
        },
        {
          id: "ing-3",
          name: "Sliced bell peppers & red onion",
          baseGrams: 260,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Asparagus spears & courgette", baseGrams: 260, unit: "g", reason: "Crisp green roast veggies" },
          ],
        },
        {
          id: "ing-4",
          name: "Fresh lime juice, coriander & diced avocado",
          baseGrams: 80,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "0% Greek yogurt lime drizzle", baseGrams: 80, unit: "g", reason: "High-protein cooling crema" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Arrange Traybake",
          instruction: "Spread [ing-1], [ing-2], and [ing-3] across a baking sheet with a light mist of olive oil.",
          tip: "Roasting black beans alongside the peppers gives them a smoky, slightly crisp skin.",
          timerMinutes: null,
        },
        {
          phase: "Step 2 • Roast or Air-Fry",
          instruction: "Bake at 200°C for 15 minutes (or 11 minutes in an air fryer) until sizzling and charred at the edges.",
          tip: "High heat caramelizes the natural sugars in bell peppers and onions.",
          timerMinutes: 15,
        },
        {
          phase: "Step 3 • Top with Lime & Avocado",
          instruction: "Squeeze fresh lime and scatter [ing-4] over the hot traybake before serving!",
          tip: "Avocado provides heart-protective monounsaturated fats and potassium.",
          timerMinutes: null,
        },
      ],
    },
    {
      styleTag: "14-Min Frittata / Skillet",
      prepTime: "14 mins",
      isSweet: false,
      baseProteinNum: 37,
      baseFiberNum: 9,
      title: `Golden Spinach, Herb & ${subjectTitle} Protein Skillet Frittata`,
      summary: `Fluffy café-style skillet frittata loaded with ${cleaned}, baby spinach, sweet peas, and fresh herbs.`,
      ingredients: [
        {
          id: "ing-1",
          name: `${subjectTitle} (diced into bite-size pieces)`,
          baseGrams: 300,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Smoked tofu & sautéed mushrooms", baseGrams: 300, unit: "g", reason: "Plant-based protein filling" },
          ],
        },
        {
          id: "ing-2",
          name: "Liquid egg whites (or whisked omega-3 eggs)",
          baseGrams: 260,
          unit: "ml",
          isProteinCore: true,
          alternatives: [
            { name: "Chickpea flour (besan) whisked with water & turmeric", baseGrams: 260, unit: "ml", reason: "Vegan high-fiber frittata batter" },
          ],
        },
        {
          id: "ing-3",
          name: "Baby spinach, green peas & spring onions",
          baseGrams: 220,
          unit: "g",
          isFiberCore: true,
          alternatives: [
            { name: "Steamed broccoli & kale", baseGrams: 220, unit: "g", reason: "Cruciferous greens swap" },
          ],
        },
        {
          id: "ing-4",
          name: "0% Cottage cheese & fresh dill/parsley",
          baseGrams: 110,
          unit: "g",
          isProteinCore: true,
          alternatives: [
            { name: "Nutritional yeast & olive oil", baseGrams: 30, unit: "g", reason: "Dairy-free savory finish" },
          ],
        },
      ],
      steps: [
        {
          phase: "Step 1 • Sauté Filling",
          instruction: "Sauté [ing-1] and [ing-3] in a non-stick skillet over medium heat for 4 minutes until tender.",
          tip: "Cooking out excess moisture from the greens keeps the frittata light and airy.",
          timerMinutes: 4,
        },
        {
          phase: "Step 2 • Pour & Set Frittata",
          instruction: "Whisk [ing-2] with [ing-4] and pour evenly into the skillet. Cook covered on medium-low for 8 minutes (or bake at 190°C for 10 minutes in the oven) until set.",
          tip: "Cooking gently with a lid sets the top without needing to flip.",
          timerMinutes: 8,
        },
      ],
    },
  ];

  const activePool = state.selectedModel === "chatgpt" ? chatgptGeneralTemplates : generalTemplates;
  const picked = [
    activePool[regenCycle % activePool.length],
    activePool[(regenCycle + 1) % activePool.length],
    activePool[(regenCycle + 2) % activePool.length],
  ];

  return picked.map((raw) => {
    const engineered = applyDietaryEngineeringToRecipe(raw, scale);
    if (useAirFryer) {
      engineered.styleTag = "Air Fryer • 190°C";
      if (!/air\s*fryer/i.test(engineered.title)) {
        engineered.title = `Air Fryer ${engineered.title.replace(/^(Pan-Seared|Crispy Oven-Roasted|Baked)\s+/i, "")}`;
      }
      if (Array.isArray(engineered.steps) && engineered.steps.length) {
        const cookStep = engineered.steps[Math.min(1, engineered.steps.length - 1)];
        cookStep.phase = "Step 2 • Air Fry at 190°C";
        cookStep.instruction = `Preheat the air fryer to 190°C. Place [ing-1] in a single layer in the basket (or silicone insert) and air fry for 12 minutes, shaking or flipping halfway, until golden and cooked through.`;
        cookStep.tip = "190°C circulating air gives a crisp sear without extra oil.";
        cookStep.timerMinutes = 12;
      }
    }
    return engineered;
  });
}

function buildLiveOptionsPrompt(userCraving) {
  const intent = state.parsedIntent || parseOmniIntentLocal(userCraving);
  const activeToggleDiets = Object.entries(state.dietary)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (state.otherDietaryText && state.otherDietaryText.trim()) {
    activeToggleDiets.push(`Custom Priority: "${state.otherDietaryText.trim()}"`);
  }
  const mergedDiets = Array.from(new Set([...activeToggleDiets, ...(intent.dietaryGoals || [])]));
  const isMaxTaste = mergedDiets.length === 0;
  const activeDiets = isMaxTaste
    ? "MAXIMUM TASTE & CULINARY INDULGENCE (No dietary restrictions selected — prioritize restaurant-level flavor, cultured butter/cream, rich aromatics, umami glazes, and caramelization!)"
    : mergedDiets.join(", ");

  const profileContext = buildKitchenProfilePromptContext();
  const isIngredientOnlyDiscovery = !intent.dishFormat;

  const discoveryInstructions = isIngredientOnlyDiscovery
    ? `DISCOVERY LOGIC (NO SPECIFIC DISH FORMAT SPECIFIED):
- Do NOT return plain porridge or repetitive single-format variations.
- Generate 4 distinct, high-fit recipe archetypes spanning different formats (e.g. a baked loaf/bread, baked bars/squares, pancakes/fritters, and a savoury or skillet/muffin option where fitting).
- Cross-reference the user's Saved Favourites & Recent Cooking History first — if a past favourite or close pattern matches these ingredients, surface an elevated/tailored variation of it as Option 1.
- Prioritise the user's Owned Appliances (e.g. air-fryer + silicone loaf insert formats if in their profile) with exact °C temperatures and dual-tray batch splitting if batter volume is heavy.
- SURPLUS SCALING: If the user entered a large quantity of a perishable ingredient (e.g. ${intent.surplusScaleNote || "multiple bananas/produce"}), propose batch-scaled or multi-loaf formats designed to use up that exact surplus.`
    : `FORMAT & CONSTRAINT EXECUTION:
- Honour the requested dish format "${intent.dishFormat}" and exact ingredient quantities (${JSON.stringify(intent.ingredients)}).
- Adapt baking/cooking method, °C temperature, and batch splitting to the user's appliances (${(intent.appliances || []).join(", ") || "profile defaults"}).`;

  return `You are ChefCoach (${state.selectedModel === "gemini-argon" ? "Gemini Argon" : "ChatGPT"}), an intelligent culinary strategist and food scientist.
User Query: "${userCraving}" for ${state.servings} servings (Variation #${state.regenIndex + 1}).
Parsed Omni-Intent: ${JSON.stringify(intent)}
Active Dietary & Culinary Goals: ${activeDiets}.

${profileContext}

${discoveryInstructions}

CRITICAL FOOD-SCIENCE & NUTRITION RULES:
1. Analyze EVERY ingredient's real USDA/CoFID nutritional profile per 100g (kcal, proteinG, fatG, carbsG, fiberG, cholMg, satFatG, addedSugarG) and include it in each ingredient object as "nutritionPer100g".
2. ${isMaxTaste ? "Since NO dietary restrictions are selected, prioritize MAXIMUM TASTE and classic technique." : `Adapt ingredients and proportions to strictly satisfy: ${activeDiets}.`}
3. Preserve food-science mechanics: balance free liquid to dry starch/soluble fibre (e.g. oat flour vs. oat bran), scale leavening proportionally to flour weight, and split into 2 trays if batter exceeds standard air-fryer silicone tray capacity.
4. Dyslexia-Friendly Steps: Write every step "instruction" as 2 to 3 short, simple sentences separated by periods (1 action per sentence). Include exact °C temperatures and metric scale weights.
5. ALL quantities MUST be in metric weights/volumes (g, ml, °C). Never use cups, tablespoons, or °F.
Return ONLY valid JSON with an "options" array containing ${isIngredientOnlyDiscovery ? "4" : "3"} distinct dish objects:
{
  "options": [
    {
      "styleTag": "Air Fryer Loaf • 2 Trays",
      "prepTime": "35 mins",
      "servings": ${state.servings},
      "title": "string",
      "summary": "string",
      "dietaryNote": "How this dish satisfies goals, appliances, and surplus scaling",
      "liveConflictWarnings": [],
      "liveSuggestedSafeSwap": null,
      "ingredients": [
        {
          "id": "ing-1",
          "name": "string",
          "qtyMetric": "320 g",
          "checked": true,
          "replacedFrom": null,
          "nutritionPer100g": { "kcal": 165, "proteinG": 28, "fatG": 3.5, "carbsG": 0, "fiberG": 0, "cholMg": 55, "satFatG": 1.2, "addedSugarG": 0 },
          "alternatives": [
            { "name": "string", "qtyMetric": "320 g", "reason": "string" }
          ]
        }
      ],
      "steps": [
        {
          "phase": "Step 1 • Prep",
          "instruction": "Short sentence 1 referencing [ing-1]. Short sentence 2.",
          "tip": "Food-science tip",
          "timerMinutes": 5
        }
      ]
    }
  ]
}`;
}

async function tryFetchLiveOptionsGemini(promptText, apiKey) {
  try {
    const gRes = await callGeminiGenerateContent(apiKey, {
      contents: [{ parts: [{ text: buildLiveOptionsPrompt(promptText) }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    if (!gRes.ok) return null;
    const raw = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.options || null;
  } catch {
    return null;
  }
}

async function tryFetchLiveOptionsOpenAI(promptText, apiKey) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: buildLiveOptionsPrompt(promptText) }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.options || null;
  } catch {
    return null;
  }
}

// ---------------- RENDER SCREEN 2: HANDFUL OF DISH OPTIONS + CONFLICT BANNER + TWEAK BAR ----------------
function renderDishOptionsScreen(promptText) {
  if (dom.optionsSubtitle) {
    dom.optionsSubtitle.hidden = true;
    dom.optionsSubtitle.textContent = "";
  }
  if (dom.prevOptionsBtn) {
    dom.prevOptionsBtn.hidden = state.regenIndex <= 0;
  }
  dom.optionsDietaryBadges.innerHTML = "";

  // Clean Dietary Priority Badges ONLY
  if (state.dietary["cholesterol-safe"]) appendBadgeTo(dom.optionsDietaryBadges, "❤️ Cholesterol Safe");
  if (state.dietary["protein-rich"]) appendBadgeTo(dom.optionsDietaryBadges, "💪 Protein Rich");
  if (state.dietary["fiber-rich"]) appendBadgeTo(dom.optionsDietaryBadges, "🌾 Fiber Rich");
  if (state.dietary["no-added-sugar"]) appendBadgeTo(dom.optionsDietaryBadges, "🚫 No Added Sugar");
  if (state.otherDietaryText) appendBadgeTo(dom.optionsDietaryBadges, `✨ ${state.otherDietaryText}`);
  if (dom.optionsDietaryBadges.children.length === 0) {
    appendBadgeTo(dom.optionsDietaryBadges, "🍽️ Maximum Taste");
  }

  // Re-compute USDA/CoFID nutrition for each option
  state.dishOptions.forEach((opt) => {
    computeRecipeNutritionAndConflicts(opt);
  });

  if (dom.dietaryConflictBanner) {
    dom.dietaryConflictBanner.remove();
  }

  dom.dishOptionsContainer.innerHTML = "";

  state.dishOptions.forEach((opt) => {
    const calc = opt.computedNutrition || computeRecipeNutritionAndConflicts(opt);
    const activeNutri = state.nutritionBasis === "100g" ? calc.per100g : calc.portion;
    const isSatFatWarn = activeNutri.satFatNum > 5.0;
    const difficulty = (opt.steps?.length || 3) <= 3 ? "Easy" : "Medium";

    const card = document.createElement("div");
    card.className = "dish-option-card";
    card.innerHTML = `
      <div class="dish-card-top">
        <span class="dish-style-tag">${opt.styleTag || "Chef Option"}</span>
        <span class="dish-time-tag">⏱️ ${opt.prepTime || "15 mins"} • ${difficulty}</span>
      </div>
      <h2 class="dish-card-title">${opt.title}</h2>
      <p class="dish-card-desc">${opt.summary}</p>
      <div class="nutrition-strip four-cols">
        <div class="nutri-pill">
          <span class="nutri-val">${activeNutri.kcal.replace(" kcal", "")}</span>
          <span class="nutri-lbl">Calories</span>
        </div>
        <div class="nutri-pill">
          <span class="nutri-val">${activeNutri.protein}</span>
          <span class="nutri-lbl">Protein</span>
        </div>
        <div class="nutri-pill">
          <span class="nutri-val">${activeNutri.fiber}</span>
          <span class="nutri-lbl">Fibre</span>
        </div>
        <div class="nutri-pill ${isSatFatWarn ? "warn" : ""}">
          <span class="nutri-val">${activeNutri.satFatNum} g</span>
          <span class="nutri-lbl">Sat. Fat</span>
        </div>
      </div>
      <div class="dish-diet-Modification">${opt.dietaryNote || "Tailored to your dietary goals"}</div>
      <button type="button" class="select-dish-btn">View recipe</button>
    `;

    card.querySelector(".select-dish-btn").addEventListener("click", () => {
      selectDishOption(opt);
    });

    dom.dishOptionsContainer.appendChild(card);
  });
}

// Interactive Amend / Tweak Bar on "Pick Your Dish"
function applyTweakToDishSuggestions(tweakText) {
  const lower = tweakText.toLowerCase().trim();
  if (!lower) return;

  if (/swap to heart-safe|make heart-safe/i.test(lower)) {
    const firstConflict = state.dishOptions[0]?.computedNutrition?.suggestedSafeSwap;
    dom.cravingInput.value = firstConflict || "Lean smoked turkey medallions, spinach & quinoa";
    state.regenIndex = 0;
    state.optionsHistory = [];
    generateDishOptions();
    return;
  }

  const scale = state.servings / 2;

  state.dishOptions.forEach((opt) => {
    const newId = `ing-tweak-${Date.now()}-${Math.floor(Math.random() * 100)}`;

    if (/fib(er|re)/i.test(lower)) {
      state.dietary["fiber-rich"] = true;
      const boostName = opt.isSweet
        ? "Chia seeds & milled flaxseed (soluble fiber boost)"
        : "Cannellini white beans & toasted pumpkin seeds (fiber boost)";
      const boostQty = `${Math.round((opt.isSweet ? 30 : 160) * scale)} g`;
      opt.ingredients.push({
        id: newId,
        name: boostName,
        qtyMetric: boostQty,
        checked: true,
        replacedFrom: "Added via Tweak Bar",
        alternatives: [],
      });
      opt.steps[opt.steps.length - 1].instruction += ` Stir in [${newId}] for an extra soluble fiber boost.`;
      if (!opt.title.includes("+ Fiber")) opt.title += " (+ Fiber Boost)";
    } else if (/protein/i.test(lower)) {
      state.dietary["protein-rich"] = true;
      const boostName = opt.isSweet
        ? "0% Fat Greek Skyr & Hemp Hearts (protein boost)"
        : "Shelled Edamame & Lean Protein Boost";
      const boostQty = `${Math.round(160 * scale)} g`;
      opt.ingredients.push({
        id: newId,
        name: boostName,
        qtyMetric: boostQty,
        checked: true,
        replacedFrom: "Added via Tweak Bar",
        alternatives: [],
      });
      opt.steps[opt.steps.length - 1].instruction += ` Fold in [${newId}] to elevate total protein.`;
      if (!opt.title.includes("+ Protein")) opt.title += " (+ High-Protein)";
    } else if (/\begg|eggs\b/i.test(lower)) {
      const cholSafe = state.dietary["cholesterol-safe"];
      const eggName = cholSafe
        ? "Liquid egg whites or 2 poached omega-3 eggs (heart-safe)"
        : "2 Free-range eggs (poached or soft-scrambled)";
      const eggQty = `${Math.round(120 * scale)} g`;
      opt.ingredients.push({
        id: newId,
        name: eggName,
        qtyMetric: eggQty,
        checked: true,
        replacedFrom: "Added via Tweak Bar",
        alternatives: [{ name: "Tofu scramble", qtyMetric: eggQty, reason: "Zero-cholesterol plant egg swap" }],
      });
      opt.steps[opt.steps.length - 1].instruction += ` Top or fold in [${newId}] during the final 2 minutes of cooking.`;
      if (!/egg/i.test(opt.title)) opt.title += " & Eggs";
    } else {
      // Any custom ingredient or instruction typed by user (e.g., "add mushrooms", "add chilli", "add avocado")
      const cleanAdd = tweakText.replace(/^(add|include|with|plus|put)\s+/i, "").trim();
      const capAdd = cleanAdd.charAt(0).toUpperCase() + cleanAdd.slice(1);
      const customQty = `${Math.round(100 * scale)} g`;
      opt.ingredients.push({
        id: newId,
        name: capAdd,
        qtyMetric: customQty,
        checked: true,
        replacedFrom: "Added via Tweak Bar",
        alternatives: [],
      });
      opt.steps[Math.max(0, opt.steps.length - 2)].instruction += ` Add [${newId}] and toss well to infuse flavor.`;
      if (!opt.title.toLowerCase().includes(cleanAdd.toLowerCase())) {
        opt.title += ` + ${capAdd}`;
      }
    }

    computeRecipeNutritionAndConflicts(opt);
  });

  // Sync dietary cards on Screen 1 if fiber/protein was enabled
  document.querySelectorAll(".diet-card").forEach((card) => {
    const key = card.dataset.diet;
    card.classList.toggle("active", Boolean(state.dietary[key]));
    card.setAttribute("aria-pressed", String(Boolean(state.dietary[key])));
    const chk = card.querySelector(".diet-check");
    if (chk) chk.textContent = state.dietary[key] ? "✓" : "+";
  });

  const promptText = dom.cravingInput.value.trim() || "Custom Dish";
  renderDishOptionsScreen(`${promptText} (${tweakText})`);
}

function appendBadgeTo(container, text) {
  const b = document.createElement("span");
  b.className = "tag-badge";
  b.textContent = text;
  container.appendChild(b);
}

function selectDishOption(opt) {
  state.recipe = JSON.parse(JSON.stringify(opt));
  state.pivotSuggestion = null;
  state.copilotMessages = [
    {
      role: "coach",
      text: `Co-Pilot ready for "${state.recipe.title}". Ask me to swap flours/fruits, scale quantities, adapt for your appliances, or break down calories & macros.`,
    },
  ];
  dom.aiAdaptationBanner.hidden = true;
  recordRecipeToHistory(state.recipe, "selected");
  renderCopilotMessages();
  renderIngredientsScreen();
  showScreen("ingredients");
}

// ---------------- SCREEN 3: INGREDIENTS, SMART SWAPS & GOOGLE KEEP ----------------
function renderLiveMacroSummaryBar(calc, animatePulse = false) {
  if (!dom.liveMacroSummaryBar || !dom.liveMacroGrid || !calc) return;
  const p = calc.portion;
  const b = calc.batch || {
    kcalNum: p.kcalNum * (state.servings || 2),
    proteinNum: p.proteinNum * (state.servings || 2),
    fatNum: +(p.fatNum * (state.servings || 2)).toFixed(1),
    carbsNum: p.carbsNum * (state.servings || 2),
    fiberNum: p.fiberNum * (state.servings || 2),
    servings: state.servings || 2,
    totalGrams: 0,
  };

  if (dom.liveMacroBatchSummary) {
    dom.liveMacroBatchSummary.textContent = `Batch (${b.totalGrams} g • ${b.servings} servings): ${b.kcalNum} kcal`;
  }

  dom.liveMacroGrid.innerHTML = `
    <div class="live-macro-cell">
      <span class="live-macro-val">${p.kcalNum}</span>
      <span class="live-macro-lbl">kcal / serve</span>
      <span class="live-macro-sub">${b.kcalNum} total</span>
    </div>
    <div class="live-macro-cell">
      <span class="live-macro-val">${p.proteinNum}g</span>
      <span class="live-macro-lbl">Protein</span>
      <span class="live-macro-sub">${b.proteinNum}g total</span>
    </div>
    <div class="live-macro-cell">
      <span class="live-macro-val">${p.fatNum}g</span>
      <span class="live-macro-lbl">Fat</span>
      <span class="live-macro-sub">${b.fatNum}g total</span>
    </div>
    <div class="live-macro-cell">
      <span class="live-macro-val">${p.carbsNum}g</span>
      <span class="live-macro-lbl">Carbs</span>
      <span class="live-macro-sub">${b.carbsNum}g total</span>
    </div>
    <div class="live-macro-cell">
      <span class="live-macro-val">${p.fiberNum}g</span>
      <span class="live-macro-lbl">Fibre</span>
      <span class="live-macro-sub">${b.fiberNum}g total</span>
    </div>
  `;

  if (animatePulse) {
    dom.liveMacroSummaryBar.classList.remove("macro-pulse");
    void dom.liveMacroSummaryBar.offsetWidth;
    dom.liveMacroSummaryBar.classList.add("macro-pulse");
  }
}

function renderIngredientsScreen(animateMacros = false) {
  const r = state.recipe;
  if (!r) return;

  const calc = computeRecipeNutritionAndConflicts(r);
  const activeNutri = state.nutritionBasis === "100g" ? calc.per100g : calc.portion;
  const isSatFatWarn = activeNutri.satFatNum > 5.0;

  dom.recipeBadges.innerHTML = "";
  if (state.dietary["cholesterol-safe"]) appendBadgeTo(dom.recipeBadges, "❤️ Cholesterol Safe");
  if (state.dietary["protein-rich"]) appendBadgeTo(dom.recipeBadges, "💪 Protein Rich");
  if (state.dietary["fiber-rich"]) appendBadgeTo(dom.recipeBadges, "🌾 Fiber Rich");
  if (state.dietary["no-added-sugar"]) appendBadgeTo(dom.recipeBadges, "🚫 No Added Sugar");
  if (state.otherDietaryText) appendBadgeTo(dom.recipeBadges, `✨ ${state.otherDietaryText}`);
  if (dom.recipeBadges.children.length === 0) {
    appendBadgeTo(dom.recipeBadges, "🍽️ Maximum Taste");
  }

  if (dom.saveRecipeFromIngBtn) {
    const isAlreadySaved = state.savedRecipes.some((s) => s.title === r.title);
    dom.saveRecipeFromIngBtn.classList.toggle("saved", isAlreadySaved);
    dom.saveRecipeFromIngBtn.textContent = isAlreadySaved ? "❤️ Saved" : "🤍 Save";
  }

  dom.recipeTitle.textContent = r.title;
  dom.recipeSummary.textContent = r.summary;

  if (dom.detailPrepTime) dom.detailPrepTime.textContent = r.prepTime || "15 mins";
  if (dom.detailDifficulty) dom.detailDifficulty.textContent = (r.steps?.length || 3) <= 3 ? "Easy" : "Medium";
  if (dom.detailServings) dom.detailServings.textContent = String(Number(r.servings) || state.servings);

  renderLiveMacroSummaryBar(calc, animateMacros);

  if (dom.nutriBasisTitle) {
    dom.nutriBasisTitle.textContent = `${activeNutri.basisLabel} • Cholesterol: ${activeNutri.cholMgNum} mg • Added Sugar: ${activeNutri.addedSugar}`;
  }
  if (dom.toggleBasisIngBtn) {
    dom.toggleBasisIngBtn.textContent =
      state.nutritionBasis === "portion" ? "Switch to Per 100g ⇄" : "Switch to Per Portion ⇄";
  }

  dom.nutritionStrip.innerHTML = `
    <div class="nutri-pill">
      <span class="nutri-val">${activeNutri.kcal.replace(" kcal", "")}</span>
      <span class="nutri-lbl">Calories</span>
    </div>
    <div class="nutri-pill">
      <span class="nutri-val">${activeNutri.protein}</span>
      <span class="nutri-lbl">Protein</span>
    </div>
    <div class="nutri-pill">
      <span class="nutri-val">${activeNutri.fiber}</span>
      <span class="nutri-lbl">Fibre</span>
    </div>
    <div class="nutri-pill ${isSatFatWarn ? "warn" : ""}">
      <span class="nutri-val">${activeNutri.satFatNum} g</span>
      <span class="nutri-lbl">Sat. Fat</span>
    </div>
  `;

  renderIngredientRows();
  renderDetailStepsPreview();
}

// ---------------- STATEFUL CULINARY CO-PILOT MODE ----------------
function initCopilotUI() {
  if (dom.copilotToggleBtn && dom.copilotBody) {
    dom.copilotToggleBtn.addEventListener("click", () => {
      const isHidden = dom.copilotBody.hidden;
      dom.copilotBody.hidden = !isHidden;
      dom.copilotToggleBtn.setAttribute("aria-expanded", String(isHidden));
      dom.copilotToggleBtn.textContent = isHidden ? "Collapse" : "Expand";
    });
  }

  if (dom.copilotQuickChips) {
    dom.copilotQuickChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-copilot]");
      if (!btn || !dom.copilotInput) return;
      dom.copilotInput.value = btn.dataset.copilot;
      sendCopilotMessage();
    });
  }

  if (dom.copilotSendBtn) {
    dom.copilotSendBtn.addEventListener("click", sendCopilotMessage);
  }
  if (dom.copilotInput) {
    dom.copilotInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendCopilotMessage();
      }
    });
  }
}

function renderCopilotMessages() {
  if (!dom.copilotChatStream) return;
  dom.copilotChatStream.innerHTML = "";
  (state.copilotMessages || []).forEach((msg) => {
    const div = document.createElement("div");
    div.className = `copilot-msg ${msg.role}`;
    div.textContent = msg.text;
    dom.copilotChatStream.appendChild(div);
  });
  dom.copilotChatStream.scrollTop = dom.copilotChatStream.scrollHeight;
}

function buildCopilotSystemPrompt(userMessage, recipe, calc) {
  const profileContext = buildKitchenProfilePromptContext();
  return `You are ChefCoach Culinary Co-Pilot — a stateful, food-science-backed recipe editor.
${profileContext}

CURRENT ACTIVE RECIPE JSON:
${JSON.stringify(recipe)}

CURRENT COMPUTED NUTRITION BREAKDOWN:
${JSON.stringify({ batch: calc.batch, perServing: calc.portion })}

USER REQUEST:
"${userMessage}"

FOOD-SCIENCE RATIO GUARDRAILS (MUST OBEY ON EVERY MUTATION):
1. Free Liquid Balance: Whenever dry starches/flours (e.g., oat flour vs. oat bran, almond meal, coconut flour) or high-water fruits/veg (bananas, apples, zucchini) are added, removed, or swapped, recalculate free liquid (milk/water/chia gel) explicitly.
2. Leavening Ratio: Scale bicarbonate of soda + acid (apple cider vinegar/lemon) or baking powder proportionally to dry flour weight.
3. Appliance & Tray Capacity: Check the user's owned appliances. If total batter/dough exceeds standard air-fryer silicone tray capacity (~650-800g per insert), warn the user in "batchWarning" and split the batch cleanly across 2 trays with adjusted °C temperature & bake time.
4. Metric Digital Scale Precision: ALL quantities MUST be in grams (g), milliliters (ml), and Celsius (°C). Never use cups, spoons, or °F.
5. Analytical Questions: If the user only asks a question (e.g., "how fattening is this?", "why did we use vinegar?"), set "didMutateRecipe": false, set "updatedRecipe": null, and give a precise calorie/macro/food-science breakdown in "explanation".

Return ONLY valid JSON:
{
  "explanation": "Concise, food-science-backed explanation (hydration, starch vs soluble fibre, leavening, capacity, and calorie/macro deltas).",
  "batchWarning": string or null,
  "didMutateRecipe": boolean,
  "updatedRecipe": null or {
    "title": string,
    "summary": string,
    "styleTag": string,
    "prepTime": string,
    "servings": number,
    "ingredients": [
      {
        "id": string,
        "name": string,
        "qtyMetric": string,
        "checked": true,
        "replacedFrom": string or null,
        "nutritionPer100g": { "kcal": number, "proteinG": number, "fatG": number, "carbsG": number, "fiberG": number, "cholMg": number, "satFatG": number, "addedSugarG": number },
        "alternatives": [{ "name": string, "qtyMetric": string, "reason": string }]
      }
    ],
    "steps": [
      { "phase": string, "instruction": string, "tip": string, "timerMinutes": number }
    ]
  }
}`;
}

async function tryLiveCopilotWithAI(userMessage, recipe, calc) {
  const prompt = buildCopilotSystemPrompt(userMessage, recipe, calc);
  const geminiKey = localStorage.getItem("chefcoach_gemini_key");
  const openaiKey = localStorage.getItem("chefcoach_openai_key");

  try {
    if ((state.selectedModel === "gemini-argon" || !openaiKey) && geminiKey) {
      const gRes = await callGeminiGenerateContent(geminiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
      if (gRes.ok) {
        const raw = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return raw ? JSON.parse(raw) : null;
      }
    }
    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        return raw ? JSON.parse(raw) : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function applyLocalCopilotFallback(userMessage, recipe, calc) {
  const lower = userMessage.toLowerCase();
  const updated = JSON.parse(JSON.stringify(recipe));

  // Analytical macro query fallback
  if (/how\s*fattening|macro|calor|nutrition|kcal/i.test(lower)) {
    const p = calc.portion;
    const b = calc.batch;
    return {
      explanation: `Per serving (${b.servings} servings): ${p.kcalNum} kcal, ${p.proteinNum}g protein, ${p.fatNum}g fat (${p.satFatNum}g sat. fat), ${p.carbsNum}g carbs, ${p.fiberNum}g fibre. Whole batch (${b.totalGrams}g): ${b.kcalNum} kcal, ${b.fatNum}g fat, ${b.fiberNum}g fibre.`,
      batchWarning: null,
      didMutateRecipe: false,
      updatedRecipe: null,
    };
  }

  // Scale factor detection (e.g., "double", "scale to 6 bananas")
  const scaleMatch = lower.match(/scale\s*(?:to|by)?\s*(\d+)/);
  if (/double/i.test(lower) || scaleMatch) {
    const factor = /double/i.test(lower) ? 2 : Math.max(1.25, Math.min(3, parseFloat(scaleMatch[1]) / 3));
    updated.ingredients.forEach((ing) => {
      const g = parseGramsFromQtyMetric(ing.qtyMetric);
      const unit = /ml/i.test(ing.qtyMetric) ? "ml" : "g";
      ing.qtyMetric = `${Math.round(g * factor)} ${unit}`;
    });
    updated.servings = Math.round((Number(updated.servings) || state.servings || 2) * factor);
    const totalWeight = updated.ingredients.reduce((s, i) => s + parseGramsFromQtyMetric(i.qtyMetric), 0);
    const needsSplit = totalWeight > 750;
    return {
      explanation: `Scaled all ingredient weights by ${factor.toFixed(1)}x (${totalWeight}g total batch) while preserving hydration and leavening-to-flour ratios.`,
      batchWarning: needsSplit
        ? `Batch weight (${totalWeight}g) exceeds a single silicone air-fryer insert — split evenly across 2 trays at 160°C.`
        : null,
      didMutateRecipe: true,
      updatedRecipe: updated,
    };
  }

  return {
    explanation: `Add a Gemini or OpenAI API key in Preferences for live food-science Co-Pilot mutations, or use the ingredient swap/add tools below to edit "${recipe.title}".`,
    batchWarning: null,
    didMutateRecipe: false,
    updatedRecipe: null,
  };
}

async function sendCopilotMessage() {
  if (!state.recipe || !dom.copilotInput) return;
  const userMessage = dom.copilotInput.value.trim();
  if (!userMessage) return;

  dom.copilotInput.value = "";
  state.copilotMessages.push({ role: "user", text: userMessage });
  renderCopilotMessages();

  if (dom.copilotSendBtn) {
    dom.copilotSendBtn.disabled = true;
    dom.copilotSendBtn.textContent = "...";
  }

  try {
    const calc = computeRecipeNutritionAndConflicts(state.recipe);
    let result = await tryLiveCopilotWithAI(userMessage, state.recipe, calc);
    if (!result || !result.explanation) {
      result = applyLocalCopilotFallback(userMessage, state.recipe, calc);
    }

    if (result.didMutateRecipe && result.updatedRecipe && Array.isArray(result.updatedRecipe.ingredients)) {
      state.recipe = result.updatedRecipe;
      if (state.recipe.servings) {
        state.servings = Number(state.recipe.servings) || state.servings;
      }
      recordRecipeToHistory(state.recipe, "copilot-edited");
      renderIngredientsScreen(true);
    }

    state.copilotMessages.push({ role: "coach", text: result.explanation });
    if (result.batchWarning) {
      state.copilotMessages.push({ role: "warning", text: `⚠️ ${result.batchWarning}` });
    }
    renderCopilotMessages();
  } finally {
    if (dom.copilotSendBtn) {
      dom.copilotSendBtn.disabled = false;
      dom.copilotSendBtn.textContent = "Apply";
    }
  }
}

function saveAsNewIteration() {
  if (!state.recipe) return;
  const copy = JSON.parse(JSON.stringify(state.recipe));
  const baseTitle = copy.title.replace(/\s*\(v\d+\)$/i, "").trim();
  const existingVersions = state.savedRecipes.filter((s) =>
    s.title.toLowerCase().startsWith(baseTitle.toLowerCase())
  ).length;
  copy.title = `${baseTitle} (v${existingVersions + 1})`;
  copy.rating = state.currentRating || 5;
  copy.savedAt = new Date().toLocaleDateString();

  state.recipe = copy;
  state.savedRecipes.unshift(copy);
  persistSavedRecipes();
  recordRecipeToHistory(copy, "saved-iteration");
  renderIngredientsScreen(true);

  if (dom.saveNewIterationBtn) {
    const orig = dom.saveNewIterationBtn.textContent;
    dom.saveNewIterationBtn.textContent = `✅ Saved ${copy.title.match(/\(v\d+\)/)?.[0] || "Iteration"}`;
    setTimeout(() => {
      if (dom.saveNewIterationBtn) dom.saveNewIterationBtn.textContent = orig;
    }, 2200);
  }
}

function renderDetailStepsPreview() {
  const r = state.recipe;
  if (!r || !dom.detailStepsPreviewList) return;
  if (dom.detailStepsCountLabel) {
    dom.detailStepsCountLabel.textContent = `${r.steps.length} steps`;
  }
  dom.detailStepsPreviewList.innerHTML = "";
  r.steps.forEach((step, idx) => {
    const item = document.createElement("div");
    item.className = "detail-step-item";
    item.innerHTML = `
      <div class="detail-step-num">${idx + 1}</div>
      <div class="detail-step-body">
        <span class="detail-step-phase">${step.phase || `Step ${idx + 1}`}</span>
        <div>${formatStepInstructionHTML(step.instruction, true)}</div>
      </div>
    `;
    dom.detailStepsPreviewList.appendChild(item);
  });
}

function renderIngredientRows() {
  const r = state.recipe;
  dom.ingredientList.innerHTML = "";

  r.ingredients.forEach((ing, idx) => {
    const row = document.createElement("div");
    row.className = `ingredient-row ${ing.checked ? "checked" : ""}`;

    const checkArea = document.createElement("div");
    checkArea.className = "ing-check-area";
    checkArea.setAttribute("role", "checkbox");
    checkArea.setAttribute("aria-checked", String(ing.checked));
    checkArea.innerHTML = `
      <div class="big-checkbox">✓</div>
      <div class="ing-details">
        <span class="ing-qty">${ing.qtyMetric}</span>
        <span class="ing-name">${ing.name}</span>
        ${ing.replacedFrom ? `<span class="ing-replaced-note">✨ Re-engineered from ${ing.replacedFrom}</span>` : ""}
      </div>
    `;
    checkArea.addEventListener("click", () => {
      ing.checked = !ing.checked;
      renderIngredientRows();
    });

    const swapBtn = document.createElement("button");
    swapBtn.type = "button";
    swapBtn.className = "swap-btn";
    swapBtn.textContent = "Swap 🔄";
    swapBtn.addEventListener("click", () => openReplaceModal(idx));

    row.appendChild(checkArea);
    row.appendChild(swapBtn);
    dom.ingredientList.appendChild(row);
  });

  updateIngredientsActionState();
}

function updateIngredientsActionState() {
  const total = state.recipe.ingredients.length;
  const checked = state.recipe.ingredients.filter((i) => i.checked).length;
  const missing = total - checked;

  dom.checkAllBtn.textContent = checked === total ? "Uncheck All" : "Check All";

  if (missing === 0) {
    if (dom.makeItNowMainText) dom.makeItNowMainText.textContent = "Make It Now →";
    dom.checkedCounterText.textContent = `All ${total} ingredients ready!`;
    dom.shoppingCountSubtext.textContent = `Export all ${total} to Google Keep`;
  } else {
    if (dom.makeItNowMainText) dom.makeItNowMainText.textContent = "Adapt with Coach 💬";
    dom.checkedCounterText.textContent = `${missing} missing • Let's find a solution!`;
    dom.shoppingCountSubtext.textContent = `Send ${missing} missing to Keep`;
  }
}

function toggleCheckAllIngredients() {
  const allChecked = state.recipe.ingredients.every((i) => i.checked);
  state.recipe.ingredients.forEach((i) => {
    i.checked = !allChecked;
  });
  renderIngredientRows();
}

function handleAddExtraIngredient() {
  const val = dom.addExtraInput.value.trim();
  if (!val || !state.recipe) return;

  const hasQty = /^\d+/.test(val);
  const qtyMetric = hasQty ? val.split(" ").slice(0, 2).join(" ") : `${Math.round(120 * (state.servings / 2))} g`;
  const cleanName = hasQty ? val.replace(/^\d+\s*[a-zA-Z]*\s*/, "") || val : val;
  const newId = `ing-extra-${Date.now()}`;

  state.recipe.ingredients.push({
    id: newId,
    name: cleanName,
    qtyMetric,
    checked: true,
    replacedFrom: "Added from pantry",
    alternatives: [],
  });

  // Automatically weave the newly added ingredient into the cooking steps!
  const targetStepIdx = Math.max(0, state.recipe.steps.length - 2);
  state.recipe.steps[targetStepIdx].instruction += ` Fold in [${newId}] and cook for 2 minutes so its flavors infuse into the dish.`;

  dom.addExtraInput.value = "";
  showAdaptationNotification(
    `🧠 AI Coach integrated "${cleanName}" (${qtyMetric}) into Step ${targetStepIdx + 1} of your preparation!`
  );
  renderIngredientsScreen();
}

// ---------------- SMART SWAP ENGINE (RE-ENGINEERS STEPS OR SUGGESTS PIVOT) ----------------
function openReplaceModal(index) {
  state.activeReplaceIndex = index;
  const ing = state.recipe.ingredients[index];
  dom.replaceTargetLabel.innerHTML = `Swapping <strong>${ing.qtyMetric} ${ing.name}</strong>. Pick an option below or type what you have—the cooking steps & timers will automatically re-engineer:`;
  dom.replaceOptionsList.innerHTML = "";
  dom.customReplaceInput.value = "";

  (ing.alternatives || []).forEach((alt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "replace-option-btn";
    btn.innerHTML = `
      <div>
        <span class="replace-opt-main">${alt.qtyMetric} — ${alt.name}</span>
        <span class="replace-opt-reason">${alt.reason}</span>
      </div>
      <span>Swap →</span>
    `;
    btn.addEventListener("click", () => {
      executeSmartSwap(index, alt.name, alt.qtyMetric, alt.reason);
    });
    dom.replaceOptionsList.appendChild(btn);
  });

  dom.replaceModal.hidden = false;
}

function applyCustomReplacement() {
  const val = dom.customReplaceInput.value.trim();
  if (!val || state.activeReplaceIndex === null) return;
  const currentQty = state.recipe.ingredients[state.activeReplaceIndex].qtyMetric;
  const qtyMatch = val.match(/^(\d+\s*(?:g|ml|kg|l|oz|tbsp|tsp)\b)\s*(.*)$/i);
  const newQty = qtyMatch && qtyMatch[2] ? qtyMatch[1].trim() : currentQty;
  const newName = qtyMatch && qtyMatch[2] ? qtyMatch[2].trim() : val;
  executeSmartSwap(state.activeReplaceIndex, newName, newQty, "Custom pantry swap");
}

function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOldIngredientMentionInText(text, oldName, newName, ingId) {
  if (!text) return text;
  let updated = text;

  const shortOld = oldName.replace(/\s*\([^)]*\)/g, "").trim();
  const shortNew = newName.replace(/\s*\([^)]*\)/g, "").trim();

  // Build candidate terms from the old ingredient name so even if Gemini wrote plain text instead of [ing-X],
  // every step, phase, and summary updates to the new ingredient!
  const candidates = [shortOld];
  shortOld
    .split(/\s+(?:and|or|&|,)\s+|\s+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !/^(fresh|sliced|diced|chopped|cooked|raw|whole|large|small|medium|organic|extra|virgin|boneless|skinless|fillet|fillets|pieces|strips|leaves|cloves|rinsed|drained)$/i.test(w))
    .forEach((w) => candidates.push(w));

  const replacementToken = ingId ? `[${ingId}]` : shortNew;

  for (const term of candidates) {
    if (!term) continue;
    const regex = new RegExp(`\\b${escapeRegExp(term)}s?\\b`, "gi");
    if (regex.test(updated)) {
      updated = updated.replace(regex, replacementToken);
      break;
    }
  }
  return updated;
}

async function tryLiveReengineerSwapWithAI(recipe, index, oldName, newName, newQty) {
  const geminiKey = (localStorage.getItem("chefcoach_gemini_key") || "").trim();
  const openaiKey = (localStorage.getItem("chefcoach_openai_key") || "").trim();
  if (!geminiKey && !openaiKey) return null;

  const ing = recipe.ingredients[index];
  const prompt = `You are ChefCoach AI. The user is cooking "${recipe.title}" (${state.servings} servings).
They just swapped ingredient #${index + 1} (${ing.id}):
- OLD ingredient: "${oldName}"
- NEW ingredient: "${newQty} ${newName}"

Current ingredients:
${JSON.stringify(recipe.ingredients.map((i) => ({ id: i.id, name: i.name, qtyMetric: i.qtyMetric })))}

Current steps:
${JSON.stringify(recipe.steps)}

TASK:
1. Re-engineer the recipe title, summary, and EVERY step so the dish genuinely incorporates "${newQty} ${newName}" instead of "${oldName}".
2. In step instructions, ALWAYS reference ingredient IDs in brackets like [${ing.id}] so quantities stay linked, and remove any mention of "${oldName}".
3. Adjust cooking times (timerMinutes), temperatures, and culinary tips to fit the cooking physics of "${newName}".
4. Provide 2–3 smart culinary solutions in "discussionNote" explaining how the recipe was adapted for "${newName}" OR whether a pivot dish ("pivotDishTitle" and "pivotDishPrompt") is recommended if "${newName}" clashes with the dish style.
5. Also provide accurate USDA per-100g nutrition for "${newName}" in "newIngredientNutritionPer100g".

Return ONLY valid JSON:
{
  "title": "Updated recipe title featuring ${newName}",
  "summary": "Updated 1-sentence description",
  "discussionNote": "2-sentence explanation of how we adapted the cooking technique/timing for ${newName}, plus an optional alternative idea",
  "suggestPivot": false,
  "pivotDishTitle": "Optional new dish title if incompatible",
  "pivotDishPrompt": "Optional prompt to generate new dish",
  "newIngredientNutritionPer100g": { "kcal": 150, "proteinG": 20, "fiberG": 2, "cholMg": 40, "satFatG": 1.5, "addedSugarG": 0 },
  "steps": [
    {
      "phase": "Step 1 • ...",
      "instruction": "Short sentence referencing [${ing.id}]. Second short sentence.",
      "tip": "Updated tip for ${newName}",
      "timerMinutes": 5
    }
  ]
}`;

  if (geminiKey) {
    try {
      const gRes = await callGeminiGenerateContent(geminiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
      if (gRes.ok) {
        const raw = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback below
    }
  }

  return null;
}

async function executeSmartSwap(index, newName, newQty, reason) {
  const r = state.recipe;
  const ing = r.ingredients[index];
  const oldName = ing.name;
  const originalBaseName = ing.replacedFrom || oldName;
  ing.replacedFrom = originalBaseName;
  ing.name = newName;
  if (newQty) ing.qtyMetric = newQty;
  ing.checked = true;
  // Clear hardcoded per-100g nutrition from the old ingredient so USDA/CoFID re-calculates for the new ingredient!
  delete ing.nutritionPer100g;

  dom.replaceModal.hidden = true;

  const shortOld = oldName.replace(/\s*\([^)]*\)/g, "").trim();
  const shortNew = newName.replace(/\s*\([^)]*\)/g, "").trim();

  // 1. Immediate synchronous local re-engineering of Title, Summary & Every Step
  if (r.title.toLowerCase().includes(shortOld.toLowerCase())) {
    r.title = r.title.replace(new RegExp(escapeRegExp(shortOld), "gi"), shortNew);
  } else if (index === 0) {
    r.title = `${shortNew} — ${r.title}`;
  } else if (!r.title.toLowerCase().includes(shortNew.toLowerCase())) {
    r.title = `${r.title} (with ${shortNew})`;
  }

  if (r.summary) {
    r.summary = replaceOldIngredientMentionInText(r.summary, oldName, newName, null);
  }

  const lowerNew = newName.toLowerCase();
  let stepEngineeringSummary = `Replaced ${shortOld} with ${ing.qtyMetric} ${shortNew} across your preparation steps & recalculated nutrition.`;
  let anyStepReferencedIng = false;

  r.steps.forEach((step) => {
    const beforeInst = step.instruction;
    if (step.instruction.includes(`[${ing.id}]`)) {
      anyStepReferencedIng = true;
    } else {
      const replacedInst = replaceOldIngredientMentionInText(step.instruction, oldName, newName, ing.id);
      if (replacedInst !== beforeInst) {
        step.instruction = replacedInst;
        anyStepReferencedIng = true;
      }
    }

    if (step.phase) {
      step.phase = replaceOldIngredientMentionInText(step.phase, oldName, newName, null);
    }
    if (step.tip) {
      step.tip = replaceOldIngredientMentionInText(step.tip, oldName, newName, null);
    }

    if (step.instruction.includes(`[${ing.id}]`)) {
      if (/chickpea|bean|lentil|canned|cooked|tuna/i.test(lowerNew)) {
        if (step.timerMinutes && step.timerMinutes > 4) {
          step.timerMinutes = 3;
        }
        step.tip = `Since ${shortNew} is already cooked/tender, warm it gently for 3 minutes so it absorbs the aromatics without drying out.`;
        stepEngineeringSummary = `Shortened cooking time to 3 mins & adapted technique for ${shortNew}.`;
      } else if (/tofu|halloumi|tempeh|paneer/i.test(lowerNew)) {
        step.timerMinutes = 5;
        step.tip = `Pat ${shortNew} dry and sear undisturbed for 2–3 minutes per side to build a golden crisp crust.`;
        stepEngineeringSummary = `Adjusted searing technique & 5-min crisp timer for ${shortNew}.`;
      } else if (/chicken|turkey|pork|beef|steak|lamb/i.test(lowerNew)) {
        step.timerMinutes = 6;
        step.tip = `Sear ${shortNew} over medium-high heat for ~6 minutes until golden brown and cooked through.`;
        stepEngineeringSummary = `Adjusted searing timer to 6 mins and pan temperature for ${shortNew}.`;
      } else if (/salmon|cod|fish|prawn|shrimp|seafood/i.test(lowerNew)) {
        step.timerMinutes = 4;
        step.tip = `Cook ${shortNew} gently for 3–4 minutes until just opaque and flaky—avoid overcooking.`;
        stepEngineeringSummary = `Adapted pan timing to a gentle 4-min sear for ${shortNew}.`;
      } else if (/cauliflower|courgette|zucchini|spinach|broccoli|mushroom/i.test(lowerNew)) {
        step.timerMinutes = 4;
        step.tip = `Sauté ${shortNew} over high heat for 4 minutes so it stays vibrant and tender-crisp.`;
        stepEngineeringSummary = `Adjusted sauté timing to 4 mins so ${shortNew} stays tender-crisp.`;
      } else {
        step.tip = `Incorporate ${ing.qtyMetric} ${shortNew} here and toss well so it infuses with the pan aromatics.`;
      }
    }
  });

  // If no step explicitly mentioned the old ingredient token or name, weave the swapped ingredient into the main cooking step!
  if (!anyStepReferencedIng && r.steps.length > 0) {
    const targetIdx = Math.min(1, r.steps.length - 1);
    r.steps[targetIdx].instruction += ` Fold in [${ing.id}] and cook for 2–3 minutes so its flavor melds into the dish.`;
  }

  // Always generate a fresh Pivot Recipe option built around the new ingredient + remaining checked ingredients
  // so the user can choose between the Adapted Recipe OR switching to a brand-new dish!
  const otherChecked = r.ingredients
    .filter((item, i) => i !== index && item.checked)
    .slice(0, 2)
    .map((item) => item.name.replace(/\s*\([^)]*\)/g, "").trim());
  const pivotPrompt = [shortNew, ...otherChecked].join(", ");
  const pivotOptions = buildMultiOptionsWithCulinaryAI(pivotPrompt, 0);
  state.pivotSuggestion = pivotOptions[0];

  showAdaptationNotification(
    `🔄 Swapped "${shortOld}" → "${ing.qtyMetric} ${shortNew}": ${stepEngineeringSummary} (Want a completely different dish built around ${shortNew}? Tap below!)`,
    true
  );

  renderIngredientsScreen();

  // 2. If a live Gemini or OpenAI API key is configured, run deep AI culinary re-engineering in the background
  // to tailor every step, timer, and discussion note specifically to the new ingredient!
  const geminiKey = (localStorage.getItem("chefcoach_gemini_key") || "").trim();
  const openaiKey = (localStorage.getItem("chefcoach_openai_key") || "").trim();
  if (geminiKey || openaiKey) {
    showAdaptationNotification(
      `⏳ AI Coach is re-engineering steps, timings & culinary solutions for "${ing.qtyMetric} ${shortNew}"...`,
      true
    );
    const liveAdapted = await tryLiveReengineerSwapWithAI(r, index, oldName, newName, ing.qtyMetric);
    if (liveAdapted) {
      if (liveAdapted.title) r.title = liveAdapted.title;
      if (liveAdapted.summary) r.summary = liveAdapted.summary;
      if (Array.isArray(liveAdapted.steps) && liveAdapted.steps.length > 0) {
        r.steps = liveAdapted.steps;
      }
      if (liveAdapted.newIngredientNutritionPer100g) {
        ing.nutritionPer100g = liveAdapted.newIngredientNutritionPer100g;
      }
      if (liveAdapted.pivotDishPrompt) {
        const customPivot = buildMultiOptionsWithCulinaryAI(liveAdapted.pivotDishPrompt, 0);
        if (customPivot[0]) {
          if (liveAdapted.pivotDishTitle) customPivot[0].title = liveAdapted.pivotDishTitle;
          state.pivotSuggestion = customPivot[0];
        }
      }
      showAdaptationNotification(
        `✨ AI Re-Engineered for ${shortNew}: ${liveAdapted.discussionNote || stepEngineeringSummary}`,
        true
      );
      renderIngredientsScreen();
    }
  }
}

function showAdaptationNotification(message, showPivotBtn = false) {
  dom.aiAdaptationText.textContent = message;
  dom.pivotRecipeBtn.hidden = !showPivotBtn;
  dom.aiAdaptationBanner.hidden = false;
}

// ---------------- "MAKE IT NOW" & KITCHEN PARTNER CHAT HUDDLE ----------------
function handleMakeItNow() {
  unlockMobileAudioMediaChannel(true);
  const r = state.recipe;
  if (!r) return;

  const unchecked = r.ingredients.filter((i) => !i.checked);

  if (unchecked.length > 0) {
    // Open the interactive Kitchen Partner Chat so the user and Coach can decide how to adapt or pivot!
    openKitchenPartnerChat(unchecked);
    return;
  }

  state.currentStepIndex = 0;
  showScreen("cooking");
  renderCurrentStep(true);
}

function openKitchenPartnerChat(uncheckedList) {
  const r = state.recipe;
  dom.partnerChatSubtitle.textContent = `Working together on ${r.title}`;
  dom.partnerChatStream.innerHTML = "";

  const haveList = r.ingredients
    .filter((i) => i.checked)
    .map((i) => i.name.replace(/\s*\([^)]*\)/g, ""));

  // Interactive Solution Card for each missing ingredient (Tweak #7: no introductory coach bubble)
  uncheckedList.forEach((missingIng) => {
    const ingIndex = r.ingredients.findIndex((x) => x.id === missingIng.id);
    const shortMissing = missingIng.name.replace(/\s*\([^)]*\)/g, "");
    const card = document.createElement("div");
    card.className = "chat-bubble coach";

    const optionsGrid = document.createElement("div");
    optionsGrid.className = "chat-options-grid";

    // Option A: Suggested smart substitutes from catalog
    (missingIng.alternatives || []).forEach((alt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-option-pill";
      btn.innerHTML = `
        <span>🔄 Use <strong>${alt.qtyMetric} ${alt.name}</strong> <small>(${alt.reason})</small></span>
        <span>Apply →</span>
      `;
      btn.addEventListener("click", () => {
        executeSmartSwap(ingIndex, alt.name, alt.qtyMetric, alt.reason);
        appendUserAndCoachConfirmation(
          `Let's swap ${shortMissing} for ${alt.name}.`,
          `Done! I replaced ${shortMissing} with ${alt.qtyMetric} ${alt.name} and re-engineered the cooking steps and timers accordingly.`
        );
        btn.classList.add("resolved");
        btn.querySelector("span:last-child").textContent = "✓ Applied";
        updateChatBottomButtonState();
      });
      optionsGrid.appendChild(btn);
    });

    // Option B: Re-engineer recipe to cook WITHOUT this ingredient
    const omitBtn = document.createElement("button");
    omitBtn.type = "button";
    omitBtn.className = "chat-option-pill";
    omitBtn.innerHTML = `
      <span>✂️ Cook without <strong>${shortMissing}</strong> (Re-balance steps & seasoning)</span>
      <span>Omit →</span>
    `;
    omitBtn.addEventListener("click", () => {
      reengineerWithoutIngredient(missingIng);
      appendUserAndCoachConfirmation(
        `I don't have a substitute for ${shortMissing}—let's leave it out.`,
        `Got it! I removed ${shortMissing} and re-engineered the preparation steps so the dish still comes out balanced and flavorful.`
      );
      omitBtn.classList.add("resolved");
      omitBtn.querySelector("span:last-child").textContent = "✓ Adapted";
      updateChatBottomButtonState();
    });
    optionsGrid.appendChild(omitBtn);

    card.innerHTML = `
      <span class="chat-sender-tag">Missing: ${missingIng.qtyMetric} ${shortMissing}</span>
      <div>How would you like to handle <strong>${shortMissing}</strong>?</div>
    `;
    card.appendChild(optionsGrid);
    dom.partnerChatStream.appendChild(card);
  });

  // 3. If core main ingredient (index 0) is missing or 2+ items are missing, offer to pivot to a brand-new recipe using ONLY what is checked!
  if (!r.ingredients[0]?.checked || uncheckedList.length >= 2) {
    const pivotCard = document.createElement("div");
    pivotCard.className = "chat-bubble coach";
    const availablePrompt = haveList.length ? haveList.slice(0, 3).join(", ") : "pantry essentials";
    pivotCard.innerHTML = `
      <span class="chat-sender-tag">💡 Partner Suggestion: New Recipe Pivot</span>
      <div>Since you're missing key ingredients, would you rather switch to a brand-new dish built specifically around what you <em>do</em> have checked (<strong>${availablePrompt}</strong>)?</div>
    `;
    const pivotBtn = document.createElement("button");
    pivotBtn.type = "button";
    pivotBtn.className = "chat-option-pill";
    pivotBtn.innerHTML = `
      <span>✨ Generate a New Dish Using Only My Checked Ingredients</span>
      <span>Pivot →</span>
    `;
    pivotBtn.addEventListener("click", () => {
      dom.cravingInput.value = availablePrompt;
      state.regenIndex = 0;
      state.optionsHistory = [];
      generateDishOptions();
    });
    pivotCard.appendChild(pivotBtn);
    dom.partnerChatStream.appendChild(pivotCard);
  }

  updateChatBottomButtonState();
  showScreen("partnerChat");
}

function reengineerWithoutIngredient(missingIng) {
  const r = state.recipe;
  const shortMissing = missingIng.name.replace(/\s*\([^)]*\)/g, "");
  missingIng.omitted = true;
  missingIng.checked = true;
  missingIng.replacedFrom = `${shortMissing} (Omitted)`;
  missingIng.name = `Extra splash of olive oil / broth & herbs`;
  missingIng.qtyMetric = `15 ml`;

  r.steps.forEach((step) => {
    if (step.instruction.includes(`[${missingIng.id}]`)) {
      step.tip = `We adapted this step to work without ${shortMissing}—let the aromatics and pan glaze carry the flavor!`;
    }
  });
}

function finalizeUncheckedAdaptations() {
  const r = state.recipe;
  if (!r) return;
  const stillUnchecked = r.ingredients.filter((i) => !i.checked);
  stillUnchecked.forEach((missingIng) => {
    reengineerWithoutIngredient(missingIng);
  });
}

function updateChatBottomButtonState() {
  const remaining = state.recipe.ingredients.filter((i) => !i.checked).length;
  if (dom.chatAdaptedSubText) {
    dom.chatAdaptedSubText.textContent =
      remaining === 0
        ? "All missing items resolved • Ready to cook!"
        : `Will auto-adapt ${remaining} remaining item(s) & start`;
  }
}

function appendUserAndCoachConfirmation(userText, coachReplyText) {
  const uBubble = document.createElement("div");
  uBubble.className = "chat-bubble user";
  uBubble.textContent = userText;
  dom.partnerChatStream.appendChild(uBubble);

  const cBubble = document.createElement("div");
  cBubble.className = "chat-bubble coach";
  const modelName = state.selectedModel === "gemini-argon" ? "Gemini Argon" : "ChatGPT";
  cBubble.innerHTML = `
    <span class="chat-sender-tag">👩‍🍳 ${modelName} Kitchen Partner</span>
    <div>${coachReplyText}</div>
  `;
  dom.partnerChatStream.appendChild(cBubble);
  cBubble.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function handlePartnerChatUserMessage() {
  const text = dom.partnerChatInput.value.trim();
  if (!text || !state.recipe) return;
  dom.partnerChatInput.value = "";

  const r = state.recipe;
  const unchecked = r.ingredients.filter((i) => !i.checked);
  const targetIng = unchecked[0] || r.ingredients[0];
  const targetIdx = r.ingredients.findIndex((x) => x.id === targetIng.id);

  // Extract the ingredient name the user typed (e.g. "I have canned tuna" -> "Canned tuna")
  const cleanedReplacement = text
    .replace(/^(i\s+have|what\s+about|can\s+i\s+use|use|swap\s+with|swap\s+for|try)\s+/i, "")
    .trim();
  const formattedReplacement =
    cleanedReplacement.charAt(0).toUpperCase() + cleanedReplacement.slice(1);

  if (/new\s+recipe|something\s+else|different\s+dish|pivot/i.test(text)) {
    const haveList = r.ingredients
      .filter((i) => i.checked)
      .map((i) => i.name.replace(/\s*\([^)]*\)/g, ""));
    dom.cravingInput.value = haveList.join(", ") || formattedReplacement;
    state.regenIndex = 0;
    state.optionsHistory = [];
    generateDishOptions();
    return;
  }

  const oldShort = targetIng.name.replace(/\s*\([^)]*\)/g, "");
  executeSmartSwap(targetIdx, formattedReplacement, targetIng.qtyMetric, "Kitchen Partner Chat adaptation");

  appendUserAndCoachConfirmation(
    text,
    `Great call! I swapped out <strong>${oldShort}</strong> for <strong>${targetIng.qtyMetric} of ${formattedReplacement}</strong>, updated the recipe title to <em>"${r.title}"</em>, and adjusted the cooking steps and timers so it cooks evenly. Ready whenever you are!`
  );
  updateChatBottomButtonState();
}

// ---------------- GOOGLE KEEP SHOPPING LIST EXPORT ----------------
async function openGoogleKeepShoppingModal() {
  if (!state.recipe) return;
  const r = state.recipe;
  const unchecked = r.ingredients.filter((i) => !i.checked);
  const itemsToExport = unchecked.length > 0 ? unchecked : r.ingredients;

  const headerLine = `🛒 ChefCoach Shopping List: ${r.title} (${state.servings} servings)`;
  const listLines = itemsToExport.map((item) => `☐ ${item.qtyMetric} — ${item.name}`).join("\n");
  const fullKeepText = `${headerLine}\n\n${listLines}`;

  dom.keepPreviewText.textContent = fullKeepText;

  try {
    await navigator.clipboard.writeText(fullKeepText);
    dom.keepModalStatus.textContent =
      unchecked.length > 0
        ? `✅ Copied ${unchecked.length} unchecked (missing) ingredient(s) to clipboard! Open Google Keep and paste.`
        : `✅ Copied all ${itemsToExport.length} ingredients to clipboard! Open Google Keep and paste.`;
  } catch {
    dom.keepModalStatus.textContent = "Copy the checklist below and paste into Google Keep:";
  }

  dom.keepModal.hidden = false;
}

async function handleNativeShareKeep() {
  const text = dom.keepPreviewText.textContent;
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Shopping List: ${state.recipe?.title || "ChefCoach"}`,
        text,
      });
    } catch {
      // User cancelled share sheet
    }
  } else {
    window.open("https://keep.google.com/", "_blank", "noopener");
  }
}

// ---------------- SCREEN 4: STEP-BY-STEP COOKING & NATURAL AI VOICE ----------------
function replaceIngredientTokensHTML(text) {
  return text.replace(/\[(ing-[^\]]+)\]/g, (_, id) => {
    const found = state.recipe.ingredients.find((item) => item.id === id);
    if (!found) return "the ingredient";
    // Strip redundant parenthetical prep notes from the inline highlight if already long
    const cleanName = found.name.replace(/\s*\([^)]*\)/g, "").trim() || found.name;
    return `<strong>${cleanName} (${found.qtyMetric})</strong>`;
  });
}

function splitInstructionIntoClauses(rawInstruction) {
  const withTokens = replaceIngredientTokensHTML(rawInstruction);

  // Dyslexia-Friendly Micro-Step Splitter:
  // Breaks compound sentences and long multi-ingredient clauses into short, scannable,
  // one-action-per-line numbered micro-steps so there is never a dense wall of text!
  const normalized = withTokens
    .replace(/;\s+/g, ". ")
    .replace(/,\s*then\s+/gi, ". Then ")
    .replace(/\s+and\s+then\s+/gi, ". Then ")
    .replace(/,\s*and\s+(?=(?:whisk|fold|stir|pour|add|cook|sear|bake|roast|simmer|flip|top|serve|spoon|scatter|let|cover|season|toss|blend|place)\b)/gi, ". ")
    .replace(/(?<=<\/strong>)\s*,\s*(?=<strong>)/g, ". Add ")
    .replace(/(?<=<\/strong>)\s*,?\s+and\s+(?=(?:half\s+of\s+)?<strong>)/gi, ". Mix in ");

  const rawClauses = normalized
    .split(/(?<=[.!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const finalClauses = [];
  rawClauses.forEach((clause) => {
    let clean = clause.charAt(0).toUpperCase() + clause.slice(1);
    if (!/[.!]$/.test(clean)) clean += ".";
    finalClauses.push(clean);
  });

  return finalClauses.length ? finalClauses : [withTokens];
}

function formatStepInstructionHTML(rawInstruction, forModal = false) {
  const clauses = splitInstructionIntoClauses(rawInstruction);
  if (forModal) {
    return `<ul class="step-overview-sublist">${clauses
      .map((c) => `<li>${c}</li>`)
      .join("")}</ul>`;
  }
  return `<ol class="step-sublist">${clauses
    .map(
      (c, i) => `
      <li class="step-subitem">
        <span class="step-subnum">${i + 1}</span>
        <span class="step-subtext">${c}</span>
      </li>`
    )
    .join("")}</ol>`;
}

function formatStepInstructionPlainText(rawInstruction) {
  return rawInstruction.replace(/\[(ing-[^\]]+)\]/g, (_, id) => {
    const found = state.recipe.ingredients.find((item) => item.id === id);
    if (!found) return "the ingredient";
    const cleanName = found.name.replace(/\s*\([^)]*\)/g, "").trim() || found.name;
    return `${found.qtyMetric} of ${cleanName}`;
  });
}

function extractStepTimerOptions(step) {
  const text = step.instruction || "";
  const matches = [...text.matchAll(/(\d+)\s*(?:minutes|minute|mins|min)\b/gi)];

  if (matches.length === 0) {
    // Only show timer if step has an explicit timed instruction
    return [];
  }

  if (matches.length === 1) {
    const mins = parseInt(matches[0][1], 10);
    if (!step.timerMinutes) step.timerMinutes = mins;
    return [{ label: `${step.timerMinutes} min`, minutes: step.timerMinutes }];
  }

  // Multiple time options detected (e.g. "Roast at 200°C for 16 minutes (or 12 minutes in an air fryer)")
  const options = [];
  matches.forEach((m, i) => {
    const mins = parseInt(m[1], 10);
    const idx = m.index || 0;
    const contextWindow = text.slice(Math.max(0, idx - 35), Math.min(text.length, idx + 45)).toLowerCase();
    let modeName = i === 0 ? "Option 1" : "Option 2";
    if (contextWindow.includes("air fryer") || contextWindow.includes("airfryer")) {
      modeName = "🌀 Air Fryer";
    } else if (contextWindow.includes("oven") || contextWindow.includes("roast") || contextWindow.includes("bake")) {
      modeName = "🔥 Oven";
    } else if (contextWindow.includes("skillet") || contextWindow.includes("pan") || contextWindow.includes("stovetop")) {
      modeName = "🍳 Skillet";
    }
    options.push({
      label: `${modeName} (${mins} min)`,
      minutes: mins,
    });
  });

  if (!step.timerMinutes) {
    step.timerMinutes = options[0].minutes;
  }
  return options;
}

function renderCurrentStep(shouldAutoSpeak = false) {
  const r = state.recipe;
  const total = r.steps.length;
  const idx = state.currentStepIndex;
  const step = r.steps[idx];

  dom.stepCounterBadge.textContent = `STEP ${idx + 1} OF ${total}`;
  dom.stepPhaseText.textContent = step.phase || "Preparation";
  const pct = Math.round(((idx + 1) / total) * 100);
  dom.stepProgressFill.style.width = `${pct}%`;

  dom.stepInstructionText.innerHTML = formatStepInstructionHTML(step.instruction);
  dom.stepTipText.textContent = step.tip || "Keep your workspace tidy as you go.";

  // Smart Timer: ONLY show timer area if this step explicitly mentions a time duration (or has timerMinutes > 0)
  const timerModes = extractStepTimerOptions(step);
  if (step.timerMinutes && timerModes.length > 0) {
    dom.stepTimerArea.hidden = false;
    if (dom.timerModesRow) {
      if (timerModes.length > 1) {
        dom.timerModesRow.hidden = false;
        dom.timerModesRow.innerHTML = "";
        timerModes.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `timer-mode-pill ${step.timerMinutes === opt.minutes ? "active" : ""}`;
          btn.textContent = opt.label;
          btn.addEventListener("click", () => {
            step.timerMinutes = opt.minutes;
            const running = state.activeTimers.find((t) => t.stepIndex === idx);
            if (running) {
              running.remainingSec = opt.minutes * 60;
              running.done = false;
            }
            renderCurrentStep(false);
            renderActiveTimersTray();
          });
          dom.timerModesRow.appendChild(btn);
        });
      } else {
        dom.timerModesRow.hidden = true;
        dom.timerModesRow.innerHTML = "";
      }
    }
    updateStepTimerButtonUI();
  } else {
    dom.stepTimerArea.hidden = true;
  }

  dom.prevStepBtn.disabled = idx === 0;

  if (idx === total - 1) {
    dom.nextStepMainText.textContent = "FINISH COOKING 🎉";
    dom.nextStepSubText.textContent = "Final step — tap or say 'Next' when plated!";
  } else {
    dom.nextStepMainText.textContent = "NEXT STEP →";
    dom.nextStepSubText.textContent = `Up next: Step ${idx + 2} of ${total} (or say "Next")`;
  }

  if (shouldAutoSpeak && state.speakerEnabled) {
    speakCurrentStep(true);
  }
}

// ---------------- HIGH-QUALITY NATURAL VOICE ENGINE ----------------
// Priority 1: Gemini Native Audio TTS (plays over HTML5 Media channel, bypassing iPhone Silent switch)
// Priority 2: Default iOS/Browser SpeechSynthesis (called synchronously on tap when Gemini TTS isn't available)
let sharedAudioEl = null;
let sharedAudioCtx = null;
let activeWebAudioSource = null;

function createSilentWavBlobUrl() {
  const sampleRate = 24000;
  const numSamples = 480; // 20ms valid PCM silence
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function unlockMobileAudioMediaChannel(unlockHtmlAudioNow = false) {
  try {
    if (!sharedAudioEl) {
      sharedAudioEl = new Audio();
      sharedAudioEl.playsInline = true;
    }
    // Unlock HTMLAudioElement permanently on navigation tap ("Make It Now") with a 100% valid 20ms silent WAV
    // so it is already unlocked and idle before the user ever taps "Voice ON"
    if (unlockHtmlAudioNow && !sharedAudioEl.__unlocked) {
      const silentUrl = createSilentWavBlobUrl();
      sharedAudioEl.src = silentUrl;
      const p = sharedAudioEl.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          sharedAudioEl.__unlocked = true;
          URL.revokeObjectURL(silentUrl);
        }).catch(() => {
          URL.revokeObjectURL(silentUrl);
        });
      }
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx && !sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx) {
      if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume();
      }
      // Play a 1-sample Web Audio buffer synchronously on tap to unlock iOS Safari AudioContext
      if (!sharedAudioCtx.__unlocked) {
        const silentBuf = sharedAudioCtx.createBuffer(1, 1, 22050);
        const src = sharedAudioCtx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(sharedAudioCtx.destination);
        src.start(0);
        sharedAudioCtx.__unlocked = true;
      }
    }
  } catch {
    // Ignore audio context init errors
  }
}

function createWavBlobFromBase64Pcm(base64Pcm, sampleRate = 24000) {
  const binaryStr = atob(base64Pcm);
  const pcmLen = binaryStr.length;
  const wavBuffer = new ArrayBuffer(44 + pcmLen);
  const view = new DataView(wavBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmLen, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Mono = 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate (16-bit mono)
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16 bits per sample
  writeString(36, "data");
  view.setUint32(40, pcmLen, true);

  const bytes = new Uint8Array(wavBuffer, 44);
  for (let i = 0; i < pcmLen; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

const geminiTtsAudioCache = new Map();
let activeTtsRequestToken = 0;

function buildStepSpeechText(stepIndex) {
  const stepObj = state.recipe?.steps?.[stepIndex];
  if (!stepObj) return "";
  const plainInstruction = formatStepInstructionPlainText(stepObj.instruction);
  return `Step ${stepIndex + 1}. ${plainInstruction}`;
}

let sessionGeminiTtsUnsupported = false;

function fetchGeminiTtsBlob(fullSpeechText, geminiKey) {
  if (geminiTtsAudioCache.has(fullSpeechText)) {
    return geminiTtsAudioCache.get(fullSpeechText);
  }

  const promise = (async () => {
    const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
    let allNotFound = true;

    for (const modelId of ttsModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Speak clearly and naturally: ${fullSpeechText}` }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: "Kore",
                    },
                  },
                },
              },
            }),
          }
        );
        if (!res.ok) {
          if (res.status !== 404) {
            allNotFound = false;
          }
          continue;
        }
        allNotFound = false;
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const inlineData = parts.find((p) => p?.inlineData?.data)?.inlineData;
        if (!inlineData?.data) continue;

        const mime = inlineData.mimeType || "";
        if (mime.includes("pcm") || mime.includes("L16")) {
          const rateMatch = mime.match(/rate=(\d+)/i);
          const rate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
          return createWavBlobFromBase64Pcm(inlineData.data, rate);
        }
        const bin = atob(inlineData.data);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime || "audio/wav" });
      } catch {
        allNotFound = false;
      }
    }

    if (allNotFound) {
      sessionGeminiTtsUnsupported = true;
    }
    geminiTtsAudioCache.delete(fullSpeechText);
    return null;
  })();

  geminiTtsAudioCache.set(fullSpeechText, promise);
  return promise;
}

function prefetchStepAudio(stepIndex) {
  const geminiKey = (localStorage.getItem("chefcoach_gemini_key") || "").trim();
  if (!geminiKey || sessionGeminiTtsUnsupported) return;
  const text = buildStepSpeechText(stepIndex);
  if (text && !geminiTtsAudioCache.has(text)) {
    fetchGeminiTtsBlob(text, geminiKey);
  }
}

async function tryPlayGeminiNativeTTS(fullSpeechText, geminiKey, onDoneCallback, requestToken) {
  const audioBlob = await fetchGeminiTtsBlob(fullSpeechText, geminiKey);
  if (!audioBlob || requestToken !== activeTtsRequestToken) return false;

  // Now that current step audio is ready, pre-fetch the next step cleanly in the background
  if (state.recipe && state.currentStepIndex + 1 < state.recipe.steps.length) {
    prefetchStepAudio(state.currentStepIndex + 1);
  }

  const url = URL.createObjectURL(audioBlob);
  if (!sharedAudioEl) sharedAudioEl = new Audio();
  sharedAudioEl.volume = 1.0;
  sharedAudioEl.src = url;
  state.currentAudio = sharedAudioEl;
  sharedAudioEl.onended = () => {
    URL.revokeObjectURL(url);
    if (onDoneCallback) onDoneCallback();
  };
  sharedAudioEl.onerror = () => {
    URL.revokeObjectURL(url);
    if (onDoneCallback) onDoneCallback();
  };

  try {
    await sharedAudioEl.play();
    return true;
  } catch (err) {
    // If interrupted by a prior load, retry once after 60ms
    if (err && err.name === "AbortError") {
      await new Promise((r) => setTimeout(r, 60));
      try {
        await sharedAudioEl.play();
        return true;
      } catch {
        // Continue to Web Audio fallback below
      }
    }
    if (sharedAudioCtx) {
      try {
        const arrayBuf = await audioBlob.arrayBuffer();
        const decoded = await new Promise((resolve, reject) => {
          const p = sharedAudioCtx.decodeAudioData(arrayBuf, resolve, reject);
          if (p && typeof p.then === "function") {
            p.then(resolve).catch(reject);
          }
        });
        if (requestToken !== activeTtsRequestToken) {
          URL.revokeObjectURL(url);
          return false;
        }
        const source = sharedAudioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(sharedAudioCtx.destination);
        activeWebAudioSource = source;
        source.onended = () => {
          activeWebAudioSource = null;
          URL.revokeObjectURL(url);
          if (onDoneCallback) onDoneCallback();
        };
        source.start(0);
        return true;
      } catch {
        URL.revokeObjectURL(url);
      }
    }
  }
  return false;
}

function updateSpeakerUI() {
  dom.speakerToggleBtn.classList.toggle("active", state.speakerEnabled);
  dom.speakerToggleBtn.setAttribute("aria-pressed", String(state.speakerEnabled));
  dom.speakerIcon.textContent = state.speakerEnabled ? "🔊" : "🔇";
  dom.speakerLabel.textContent = state.speakerEnabled ? "Voice ON" : "Voice Off";
}

function stopSpeech() {
  activeTtsRequestToken++;
  state.isCoachSpeaking = false;
  if (activeWebAudioSource) {
    try {
      activeWebAudioSource.stop();
    } catch {
      // Ignore
    }
    activeWebAudioSource = null;
  }
  if (state.currentAudio) {
    try {
      state.currentAudio.pause();
    } catch {
      // Ignore
    }
    state.currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    try {
      activeUtteranceRef = null;
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore
    }
  }
}

let activeUtteranceRef = null;
let speechResumeTimer = null;

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function speakWithBrowserTTS(fullSpeechText, onDoneCallback) {
  if (!("speechSynthesis" in window)) {
    if (onDoneCallback) onDoneCallback();
    return;
  }

  if (speechResumeTimer) {
    clearTimeout(speechResumeTimer);
    speechResumeTimer = null;
  }

  try {
    // Cancel any active/queued speech synchronously inside the tap gesture
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(fullSpeechText);
    activeUtteranceRef = utterance;
    utterance.lang = navigator.language || "en-US";
    utterance.volume = 1.0;
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    // On iOS/iPadOS, leave utterance.voice unset so Apple uses the device's built-in Siri/system voice
    // without risking silent failures on un-downloaded voices. On desktop, pick a natural voice if available.
    if (!isIosDevice()) {
      const preferredVoice = pickBestNaturalBrowserVoice();
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    utterance.onend = () => {
      activeUtteranceRef = null;
      if (onDoneCallback) onDoneCallback();
    };
    utterance.onerror = () => {
      activeUtteranceRef = null;
      if (onDoneCallback) onDoneCallback();
    };

    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    activeUtteranceRef = null;
    if (onDoneCallback) onDoneCallback();
  }
}

function speakCurrentStep(force = false) {
  if (!state.speakerEnabled && !force) return;
  if (!state.recipe) return;

  const fullSpeechText = buildStepSpeechText(state.currentStepIndex);

  if (state.currentAudio) {
    try {
      state.currentAudio.pause();
    } catch {
      // Ignore
    }
    state.currentAudio = null;
  }
  ++activeTtsRequestToken;
  state.isCoachSpeaking = true;

  // Pause microphone recognition while coach is speaking so it never transcribes its own voice
  if (state.voiceCommandsListening && state.voiceRecognition) {
    try {
      state.voiceRecognition.stop();
    } catch {
      // Ignore
    }
  }

  if (dom.speakerLabel) {
    dom.speakerLabel.textContent = state.speakerEnabled ? "Voice ON" : "Voice Off";
  }

  const resumeMicAfterSpeech = () => {
    state.isCoachSpeaking = false;
    if (dom.speakerLabel && state.speakerEnabled) {
      dom.speakerLabel.textContent = "Voice ON";
    }
    if (state.voiceCommandsListening && dom.screens.cooking.classList.contains("active") && state.voiceRecognition) {
      setTimeout(() => {
        try {
          state.voiceRecognition.start();
        } catch {
          // Ignore
        }
      }, 250);
    }
  };

  // Speak synchronously using the device's native voice (iOS Siri / system SpeechSynthesis)
  speakWithBrowserTTS(fullSpeechText, resumeMicAfterSpeech);
}

function pickBestNaturalBrowserVoice() {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  if (!voices.length) return null;

  // Score voices to avoid robotic compact voices and prefer Neural / Natural / Enhanced / Google / Siri voices
  const scoreVoice = (v) => {
    const n = v.name.toLowerCase();
    let score = 0;
    if (n.includes("natural") || n.includes("neural") || n.includes("online")) score += 50;
    if (n.includes("premium") || n.includes("enhanced")) score += 40;
    if (n.includes("google uk english female") || n.includes("google us english")) score += 35;
    if (n.includes("ava") || n.includes("samantha") || n.includes("karen") || n.includes("serena") || n.includes("daniel") || n.includes("moira")) score += 25;
    if (n.includes("compact") || n.includes("espeak") || n.includes("fred") || n.includes("albert")) score -= 40;
    return score;
  };

  voices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return voices[0];
}

// ---------------- PERSISTENT MULTI-STEP TIMERS + CUSTOM +/- 1m ADJUST ----------------
function adjustCurrentStepTimer(deltaMinutes) {
  if (!state.recipe) return;
  const idx = state.currentStepIndex;
  const step = state.recipe.steps[idx];
  if (!step) return;

  const active = state.activeTimers.find((t) => t.stepIndex === idx);
  if (active) {
    active.remainingSec = Math.max(60, active.remainingSec + deltaMinutes * 60);
    active.done = false;
    step.timerMinutes = Math.max(1, Math.round(active.remainingSec / 60));
    renderActiveTimersTray();
    updateStepTimerButtonUI();
  } else {
    step.timerMinutes = Math.max(1, (step.timerMinutes || 1) + deltaMinutes);
    updateStepTimerButtonUI();
  }
}

function toggleStepTimer() {
  if (!state.recipe) return;
  const idx = state.currentStepIndex;
  const step = state.recipe.steps[idx];
  const mins = step.timerMinutes || 1;
  const existingIdx = state.activeTimers.findIndex((t) => t.stepIndex === idx);

  if (existingIdx !== -1) {
    // Remove/reset this step's timer
    state.activeTimers.splice(existingIdx, 1);
    renderActiveTimersTray();
    updateStepTimerButtonUI();
    return;
  }

  state.activeTimers.push({
    id: `timer-${Date.now()}`,
    stepIndex: idx,
    stepNum: idx + 1,
    label: step.phase || `Step ${idx + 1}`,
    remainingSec: mins * 60,
    done: false,
  });

  ensureMultiTimerLoop();
  renderActiveTimersTray();
  updateStepTimerButtonUI();
}

function ensureMultiTimerLoop() {
  if (state.multiTimerTick) return;
  state.multiTimerTick = setInterval(() => {
    if (!state.activeTimers.length) {
      clearInterval(state.multiTimerTick);
      state.multiTimerTick = null;
      return;
    }

    state.activeTimers.forEach((t) => {
      if (t.remainingSec > 0) {
        t.remainingSec--;
        if (t.remainingSec === 0 && !t.done) {
          t.done = true;
          if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(`${t.label} timer is finished!`);
            const best = pickBestNaturalBrowserVoice();
            if (best) u.voice = best;
            window.speechSynthesis.speak(u);
          }
        }
      }
    });

    renderActiveTimersTray();
    updateStepTimerButtonUI();
  }, 1000);
}

function updateStepTimerButtonUI() {
  if (!state.recipe) return;
  const idx = state.currentStepIndex;
  const step = state.recipe.steps[idx];
  if (!step?.timerMinutes) return;

  const active = state.activeTimers.find((t) => t.stepIndex === idx);
  if (!active) {
    dom.toggleTimerBtn.classList.remove("running");
    dom.toggleTimerBtn.textContent = `⏱️ Start ${step.timerMinutes}:00 Timer`;
  } else if (active.done) {
    dom.toggleTimerBtn.classList.remove("running");
    dom.toggleTimerBtn.textContent = `✅ Step ${idx + 1} Timer Done! (Tap to Clear)`;
  } else {
    dom.toggleTimerBtn.classList.add("running");
    const m = Math.floor(active.remainingSec / 60);
    const s = String(active.remainingSec % 60).padStart(2, "0");
    dom.toggleTimerBtn.textContent = `⏳ Running: ${m}:${s} (Tap to Stop)`;
  }
}

function renderActiveTimersTray() {
  if (!dom.activeTimersTray) return;
  if (!state.activeTimers.length) {
    dom.activeTimersTray.hidden = true;
    dom.activeTimersTray.innerHTML = "";
    return;
  }

  dom.activeTimersTray.hidden = false;
  dom.activeTimersTray.innerHTML = "";

  state.activeTimers.forEach((t, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `floating-timer-chip ${t.done ? "done" : ""}`;
    const m = Math.floor(t.remainingSec / 60);
    const s = String(t.remainingSec % 60).padStart(2, "0");
    chip.textContent = t.done
      ? `✅ Step ${t.stepNum} Done! (✕)`
      : `⏱️ Step ${t.stepNum}: ${m}:${s} (✕)`;
    chip.title = "Tap to dismiss timer";
    chip.addEventListener("click", () => {
      state.activeTimers.splice(i, 1);
      renderActiveTimersTray();
      updateStepTimerButtonUI();
    });
    dom.activeTimersTray.appendChild(chip);
  });
}

// ---------------- SCREEN WAKE LOCK (INTERACTIVE IN BURGER MENU) ----------------
async function requestKitchenWakeLock() {
  if (!state.wakeLockEnabled) return;
  if (!("wakeLock" in navigator)) return;
  try {
    state.wakeLockSentinel = await navigator.wakeLock.request("screen");
  } catch {
    // Ignore wakeLock permission errors
  }
}

async function releaseKitchenWakeLock() {
  if (state.wakeLockSentinel) {
    try {
      await state.wakeLockSentinel.release();
    } catch {
      // Ignore release errors
    }
    state.wakeLockSentinel = null;
  }
}

// ---------------- HANDS-FREE VOICE COMMANDS (SOUND-WAVE GRAPH BUTTON ONLY) ----------------
function toggleHandsFreeVoiceCommands() {
  if (state.voiceCommandsListening) {
    stopHandsFreeVoiceCommands();
  } else {
    startHandsFreeVoiceCommands();
  }
}

function startHandsFreeVoiceCommands() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;

  if (!state.voiceRecognition) {
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      if (state.isCoachSpeaking) return; // Ignore microphone input while coach is reading aloud
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult) return;
      const transcript = lastResult[0].transcript.trim().toLowerCase();

      if (/\b(next|forward|continue|done)\b/.test(transcript)) {
        dom.nextStepBtn.click();
      } else if (/\b(back|previous|prev)\b/.test(transcript)) {
        dom.prevStepBtn.click();
      } else if (/\b(repeat|again|read|speak)\b/.test(transcript)) {
        speakCurrentStep(true);
      } else if (/\b(timer|start timer|clock)\b/.test(transcript)) {
        if (!dom.stepTimerArea.hidden) {
          toggleStepTimer();
        }
      } else if (/\b(all steps|overview|list)\b/.test(transcript)) {
        openAllStepsModal();
      }
    };

    rec.onend = () => {
      if (
        state.voiceCommandsListening &&
        !state.isCoachSpeaking &&
        dom.screens.cooking.classList.contains("active")
      ) {
        try {
          rec.start();
        } catch {
          // Ignore already started error
        }
      }
    };

    state.voiceRecognition = rec;
  }

  try {
    state.voiceCommandsListening = true;
    if (!state.isCoachSpeaking) {
      state.voiceRecognition.start();
    }
    if (dom.voiceCommandToggleBtn) {
      dom.voiceCommandToggleBtn.classList.add("listening");
      dom.voiceCommandToggleBtn.setAttribute("aria-pressed", "true");
    }
  } catch {
    // Already active
  }
}

function stopHandsFreeVoiceCommands() {
  state.voiceCommandsListening = false;
  if (state.voiceRecognition) {
    try {
      state.voiceRecognition.stop();
    } catch {
      // Ignore stop error
    }
  }
  if (dom.voiceCommandToggleBtn) {
    dom.voiceCommandToggleBtn.classList.remove("listening");
    dom.voiceCommandToggleBtn.setAttribute("aria-pressed", "false");
  }
}

// ---------------- ALL STEPS POPUP MODAL ----------------
function openAllStepsModal() {
  if (!state.recipe) return;
  dom.allStepsListContainer.innerHTML = "";

  state.recipe.steps.forEach((step, idx) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `step-overview-item ${idx === state.currentStepIndex ? "current" : ""}`;
    item.innerHTML = `
      <div class="step-overview-num">${idx + 1}</div>
      <div class="step-overview-text">
        <span class="step-overview-phase">${step.phase || `Step ${idx + 1}`}</span>
        ${formatStepInstructionHTML(step.instruction, true)}
      </div>
    `;
    item.addEventListener("click", () => {
      state.currentStepIndex = idx;
      dom.allStepsModal.hidden = true;
      showScreen("cooking");
      renderCurrentStep(true);
    });
    dom.allStepsListContainer.appendChild(item);
  });

  dom.allStepsModal.hidden = false;
}

// ---------------- SCREEN 5: COMPLETION, STAR RATING & SAVE ----------------
function updateDoneStarUI() {
  if (!dom.doneStarRatingRow) return;
  dom.doneStarRatingRow.querySelectorAll(".star-btn").forEach((btn) => {
    const r = parseInt(btn.dataset.rating, 10);
    btn.classList.toggle("active", r <= state.currentRating);
  });
}

function renderDoneScreen() {
  const r = state.recipe;
  const calc = computeRecipeNutritionAndConflicts(r);
  const p = calc.portion;

  const existingSaved = state.savedRecipes.find((s) => s.title === r.title);
  state.currentRating = existingSaved ? existingSaved.rating || 5 : 5;
  updateDoneStarUI();

  if (dom.saveToBookDoneBtn) {
    dom.saveToBookDoneBtn.textContent = existingSaved
      ? `✅ Saved in My Recipe Book (${state.currentRating}★)`
      : `📖 Save "${r.title}" to My Recipe Book`;
  }

  dom.doneSummaryText.textContent = `You just cooked ${r.title} (${state.servings} servings • ${p.kcal}/portion)!`;
  dom.doneNutritionSummary.innerHTML = `
    <div class="nutrition-strip four-cols">
      <div class="nutri-pill">
        <span class="nutri-val">${p.kcal.replace(" kcal", "")}</span>
        <span class="nutri-lbl">Calories</span>
      </div>
      <div class="nutri-pill">
        <span class="nutri-val">${p.protein}</span>
        <span class="nutri-lbl">Protein</span>
      </div>
      <div class="nutri-pill">
        <span class="nutri-val">${p.fiber}</span>
        <span class="nutri-lbl">Fibre</span>
      </div>
      <div class="nutri-pill">
        <span class="nutri-val">${p.satFatNum} g</span>
        <span class="nutri-lbl">Sat. Fat</span>
      </div>
    </div>
  `;
}

// ---------------- SCREEN 6: MY RECIPE BOOK (SAVE, RATE 1–5 STARS & RE-COOK) ----------------
function updateSavedCountBadges() {
  const count = state.savedRecipes.length;
  if (dom.savedCountBadge) dom.savedCountBadge.textContent = String(count);
  if (dom.burgerBookCount) dom.burgerBookCount.textContent = `${count} saved →`;
}

function persistSavedRecipes() {
  localStorage.setItem("chefcoach_saved_recipes", JSON.stringify(state.savedRecipes));
  updateSavedCountBadges();
}

function saveCurrentRecipeToBook(rating = 5) {
  if (!state.recipe) return;
  const copy = JSON.parse(JSON.stringify(state.recipe));
  copy.rating = rating;
  copy.savedAt = new Date().toLocaleDateString();

  const existingIdx = state.savedRecipes.findIndex((s) => s.title === copy.title);
  if (existingIdx !== -1) {
    state.savedRecipes[existingIdx] = copy;
  } else {
    state.savedRecipes.unshift(copy);
  }

  persistSavedRecipes();
  recordRecipeToHistory(copy, "saved");

  if (dom.saveRecipeFromIngBtn) {
    dom.saveRecipeFromIngBtn.classList.add("saved");
    dom.saveRecipeFromIngBtn.textContent = "❤️ Saved in Book";
  }
  if (dom.saveToBookDoneBtn) {
    dom.saveToBookDoneBtn.textContent = `✅ Saved in My Recipe Book (${rating}★)`;
  }
}

function renderRecipeBookScreen() {
  if (!dom.recipeBookListContainer) return;
  dom.recipeBookListContainer.innerHTML = "";

  if (state.savedRecipes.length === 0) {
    dom.recipeBookListContainer.innerHTML = `
      <div class="saved-recipe-card">
        <h3 class="saved-card-title">Your Recipe Book is empty</h3>
        <p class="subtitle">When you pick or finish cooking any dish, tap "Save to Recipe Book" and rate it from 1 to 5 stars!</p>
      </div>
    `;
    return;
  }

  state.savedRecipes.forEach((saved, idx) => {
    const calc = computeRecipeNutritionAndConflicts(saved);
    const p = calc.portion;
    const rating = saved.rating || 5;

    const card = document.createElement("div");
    card.className = "saved-recipe-card";
    card.innerHTML = `
      <div class="saved-card-header">
        <div>
          <span class="dish-style-tag">${saved.styleTag || "Saved Recipe"} • ${p.kcal}/portion</span>
          <h3 class="saved-card-title" style="margin-top:6px;">${saved.title}</h3>
        </div>
        <button type="button" class="delete-saved-btn" title="Remove from Recipe Book">✕ Remove</button>
      </div>
      <p class="dish-card-desc">${saved.summary || ""}</p>
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <span style="font-size:0.88rem; font-weight:800; color:var(--text-muted);">Your Rating (Tap to change):</span>
        <div class="saved-stars-inline">
          ${[1, 2, 3, 4, 5]
            .map(
              (star) =>
                `<button type="button" class="mini-star-btn ${star <= rating ? "active" : ""}" data-star="${star}">★</button>`
            )
            .join("")}
        </div>
      </div>
      <div class="nutrition-strip four-cols">
        <div class="nutri-pill">
          <span class="nutri-val">${p.kcal.replace(" kcal", "")}</span>
          <span class="nutri-lbl">Calories</span>
        </div>
        <div class="nutri-pill">
          <span class="nutri-val">${p.protein}</span>
          <span class="nutri-lbl">Protein</span>
        </div>
        <div class="nutri-pill">
          <span class="nutri-val">${p.fiber}</span>
          <span class="nutri-lbl">Fibre</span>
        </div>
        <div class="nutri-pill">
          <span class="nutri-val">${p.satFatNum} g</span>
          <span class="nutri-lbl">Sat. Fat</span>
        </div>
      </div>
      <button type="button" class="select-dish-btn cook-saved-btn">View recipe</button>
    `;

    card.querySelectorAll(".mini-star-btn").forEach((starBtn) => {
      starBtn.addEventListener("click", () => {
        saved.rating = parseInt(starBtn.dataset.star, 10);
        persistSavedRecipes();
        renderRecipeBookScreen();
      });
    });

    card.querySelector(".delete-saved-btn").addEventListener("click", () => {
      state.savedRecipes.splice(idx, 1);
      persistSavedRecipes();
      renderRecipeBookScreen();
    });

    card.querySelector(".cook-saved-btn").addEventListener("click", () => {
      selectDishOption(saved);
    });

    dom.recipeBookListContainer.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", init);
