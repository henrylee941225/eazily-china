import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CityProvider } from "@/contexts/CityContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RestaurantGate } from "@/components/RestaurantGate";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Stays from "./pages/app/Stays.tsx";
import Exchange from "./pages/app/Exchange.tsx";
import Translate from "./pages/app/Translate.tsx";
import QuickPhrases from "./pages/app/QuickPhrases.tsx";
import GuidesHome from "./pages/app/guides/GuidesHome.tsx";
import GuideTopic from "./pages/app/guides/GuideTopic.tsx";
import GuideArticle from "./pages/app/guides/GuideArticle.tsx";
import PlaceGuide from "./pages/app/guides/PlaceGuide.tsx";
import EatDrinkDirectory from "./pages/app/guides/EatDrinkDirectory.tsx";
import NightlifeDirectory from "./pages/app/guides/NightlifeDirectory.tsx";
import ConciergeChatPage from "./pages/app/ConciergeChatPage.tsx";
import ConciergeTasks from "./pages/app/ConciergeTasks.tsx";
import Bookings from "./pages/app/Bookings.tsx";
import BookingDetail from "./pages/app/BookingDetail.tsx";
import BookingManage from "./pages/app/BookingManage.tsx";
import OpsDispatch from "./pages/ops/OpsDispatch.tsx";
import OpsNotifications from "./pages/ops/OpsNotifications.tsx";
import { OpsErrorBoundary } from "./pages/ops/OpsErrorBoundary.tsx";

import PricingPage from "./pages/app/PricingPage.tsx";
import Account from "./pages/app/Account.tsx";
import TripPass from "./pages/app/TripPass";
import EditProfile from "./pages/app/EditProfile.tsx";
import TravelPreferences from "./pages/app/TravelPreferences.tsx";
import TripDates from "./pages/app/TripDates.tsx";
import CurrencyPicker from "./pages/app/CurrencyPicker.tsx";
import NotificationSettings from "./pages/app/NotificationSettings.tsx";
import DeleteAccount from "./pages/app/DeleteAccount.tsx";
import PreTrip from "./pages/app/PreTrip.tsx";
import Transfers from "./pages/app/Transfers.tsx";
import TransferForm from "./pages/app/TransferForm.tsx";
import RestaurantBooking from "./pages/app/book/RestaurantBooking.tsx";
import PlanTime from "./pages/app/PlanTime.tsx";
import PlanMood from "./pages/app/PlanMood.tsx";
import PlanDuration from "./pages/app/plan/PlanDuration.tsx";
import PlanAreas from "./pages/app/plan/PlanAreas.tsx";
import PlanBreakfast from "./pages/app/plan/PlanBreakfast.tsx";
import PlanCafe from "./pages/app/plan/PlanCafe.tsx";
import PlanMorning from "./pages/app/plan/PlanMorning.tsx";
import PlanLunch from "./pages/app/plan/PlanLunch.tsx";
import PlanAfternoon from "./pages/app/plan/PlanAfternoon.tsx";
import PlanGenerating from "./pages/app/PlanGenerating.tsx";
import PlanResult from "./pages/app/PlanResult.tsx";
import PlanError from "./pages/app/PlanError.tsx";
import SavedPlans from "./pages/app/SavedPlans.tsx";
import PlanSavedConfirm from "./pages/app/plan/PlanSavedConfirm.tsx";
import { PlanLayout, PlanProvider } from "./contexts/PlanContext";
import MapTest from "./pages/MapTest.tsx";
import Auth from "./pages/auth/Auth.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import ProfileSetup from "./pages/onboarding/ProfileSetup.tsx";
import Welcome from "./pages/onboarding/guest/Welcome.tsx";
import LegalPage from "./pages/legal/LegalPage.tsx";
import { IOSInstallBanner } from "./components/IOSInstallBanner";
import { WelcomeSync } from "./components/WelcomeSync";
import { ConciergeLauncherProvider } from "./components/concierge/ConciergeLauncher";
import { TRANSFERS_ENABLED } from "@/lib/featureFlags";
import { NativeAppLifecycle } from "@/components/NativeAppLifecycle";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <NativeAppLifecycle />
        <AuthProvider>
          <CurrencyProvider>
            <CityProvider>
            <ConciergeLauncherProvider>
            <PlanProvider>
            <Toaster />
            <Sonner />
            <IOSInstallBanner />
            <WelcomeSync />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/profile-setup"
                element={
                  <RequireAuth requireOnboarded={false}>
                    <ProfileSetup />
                  </RequireAuth>
                }
              />
              {/* Guest product tour (pre-signup) — single 5-slide flow */}
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/welcome/features" element={<Navigate to="/welcome" replace />} />
              <Route path="/welcome/how-it-works" element={<Navigate to="/welcome" replace />} />
              <Route path="/welcome/location" element={<Navigate to="/welcome" replace />} />
              {/* Legacy routes → redirect to canonical /welcome flow */}
              <Route path="/onboarding/welcome" element={<Navigate to="/welcome" replace />} />
              <Route path="/onboarding/features" element={<Navigate to="/welcome/features" replace />} />
              <Route path="/onboarding/how-it-works" element={<Navigate to="/welcome/how-it-works" replace />} />
              <Route path="/onboarding/location" element={<Navigate to="/welcome/location" replace />} />
              {/* Home hub — public; guest state renders when no session */}
              <Route path="/" element={<Index />} />
              <Route path="/map" element={<RequireAuth><MapTest /></RequireAuth>} />
              {/* Public guide / utility screens — anonymous access */}
              <Route path="/translate" element={<Translate />} />
              <Route path="/translate/phrases" element={<QuickPhrases />} />
              <Route path="/stays" element={<Stays />} />
              <Route path="/pay" element={<Navigate to="/guides/pay-and-money" replace />} />
              <Route path="/exchange" element={<Exchange />} />
              <Route path="/pay/alipay" element={<Navigate to="/guides/pay-and-money/set-up-alipay" replace />} />
              <Route path="/pay/wechat" element={<Navigate to="/guides/pay-and-money/set-up-wechat-pay" replace />} />
              <Route path="/guides" element={<GuidesHome />} />
              <Route path="/guides/places/:placeGuideSlug" element={<PlaceGuide />} />
              <Route path="/guides/eat-and-drink/directory" element={<RestaurantGate><EatDrinkDirectory /></RestaurantGate>} />
              <Route path="/guides/eat-and-drink/nightlife" element={<RestaurantGate><NightlifeDirectory /></RestaurantGate>} />
              {/* Bars live inside the Eat & drink directory — one route only. */}
              <Route path="/bars" element={<RestaurantGate><Navigate to="/guides/eat-and-drink/directory?entity=bar" replace /></RestaurantGate>} />
              <Route path="/bars/:slug" element={<RestaurantGate><Navigate to="/guides/eat-and-drink/directory?entity=bar" replace /></RestaurantGate>} />
              <Route path="/guides/:topicSlug" element={<GuideTopic />} />
              <Route path="/guides/:topicSlug/:guideSlug" element={<GuideArticle />} />
              <Route path="/metro" element={<Navigate to="/guides/getting-around/shanghai-metro" replace />} />
              <Route path="/connectivity" element={<Navigate to="/guides/staying-connected/vpn-and-esim" replace />} />
              <Route path="/etiquette" element={<Navigate to="/guides/culture-and-etiquette/tipping-and-etiquette" replace />} />
              {/* DiDi Ride screen retired — /ride now redirects to the transfer chooser. */}
              <Route path="/ride" element={<Navigate to="/transfers" replace />} />
              <Route path="/concierge" element={<Navigate to="/" replace />} />
              <Route path="/concierge/chat" element={<RequireAuth><ConciergeChatPage /></RequireAuth>} />
              <Route path="/concierge/tasks" element={<RequireAuth><ConciergeTasks /></RequireAuth>} />
              <Route path="/bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
              <Route path="/bookings/:id" element={<RequireAuth><BookingDetail /></RequireAuth>} />
              <Route path="/bookings/:id/manage" element={<RequireAuth><BookingManage /></RequireAuth>} />
              <Route
                path="/ops"
                element={
                  <RequireAuth>
                    <OpsErrorBoundary>
                      <OpsDispatch />
                    </OpsErrorBoundary>
                  </RequireAuth>
                }
              />
              <Route
                path="/ops/notifications"
                element={
                  <RequireAuth>
                    <OpsErrorBoundary>
                      <OpsNotifications />
                    </OpsErrorBoundary>
                  </RequireAuth>
                }
              />
              <Route path="/concierge/assist" element={<Navigate to="/ops" replace />} />

              {/* Legacy assistant-marketplace routes retired — redirect to the ops task view. */}
              <Route path="/concierge/assistants" element={<Navigate to="/ops" replace />} />
              <Route path="/concierge/assistants/:id" element={<Navigate to="/ops" replace />} />
              {/* Legacy AI itinerary retired — redirect to Plan My Day. */}
              <Route path="/itinerary" element={<Navigate to="/ai/plan" replace />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/legal/:slug" element={<LegalPage />} />
              <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
              <Route path="/trip-pass" element={<TripPass />} />
              <Route path="/account/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />
              <Route path="/account/preferences" element={<RequireAuth><TravelPreferences /></RequireAuth>} />
              <Route path="/account/trip" element={<RequireAuth><TripDates /></RequireAuth>} />
              <Route path="/account/currency" element={<RequireAuth><CurrencyPicker /></RequireAuth>} />
              <Route path="/account/notifications" element={<RequireAuth><NotificationSettings /></RequireAuth>} />
              <Route path="/account/delete" element={<RequireAuth><DeleteAccount /></RequireAuth>} />
              <Route path="/pretrip" element={<RequireAuth><PreTrip /></RequireAuth>} />
              <Route
                path="/transfers"
                element={TRANSFERS_ENABLED ? <RequireAuth><Transfers /></RequireAuth> : <Navigate to="/" replace />}
              />
              <Route
                path="/transfers/:service"
                element={TRANSFERS_ENABLED ? <RequireAuth><TransferForm /></RequireAuth> : <Navigate to="/" replace />}
              />
              <Route path="/book/restaurant" element={<RestaurantGate><RequireAuth><RestaurantBooking /></RequireAuth></RestaurantGate>} />
              <Route path="/ai/plan" element={<RequireAuth><PlanLayout /></RequireAuth>}>
                <Route index element={<PlanDuration />} />
                <Route path="areas" element={<PlanAreas />} />
                <Route path="breakfast" element={<PlanBreakfast />} />
                <Route path="cafe" element={<PlanCafe />} />
                <Route path="morning" element={<PlanMorning />} />
                <Route path="lunch" element={<PlanLunch />} />
                <Route path="afternoon" element={<PlanAfternoon />} />
                {/* Legacy routes preserved for deep links */}
                <Route path="time" element={<PlanTime />} />
                <Route path="mood" element={<PlanMood />} />
                <Route path="generating" element={<PlanGenerating />} />
                <Route path="result" element={<PlanResult />} />
                <Route path="error" element={<PlanError />} />
                <Route path="saved" element={<SavedPlans />} />
                <Route path="saved-confirm" element={<PlanSavedConfirm />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PlanProvider>
            </ConciergeLauncherProvider>
            </CityProvider>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
