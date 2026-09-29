import {
  Phone,
  Ticket,
  Users,
  Route,
  Stethoscope,
  Hash,
  MoreHorizontal,
  Plane,
  type LucideIcon,
} from "lucide-react";

export type ConciergeCategory =
  | "restaurant_reservation"
  | "scenic_tickets"
  | "virtual_queue"
  | "trip_planning"
  | "hospital_booking"
  | "chinese_number_required"
  | "transfer"
  | "other";

export const CATEGORY_ICON: Record<ConciergeCategory, LucideIcon> = {
  restaurant_reservation: Phone,
  scenic_tickets: Ticket,
  virtual_queue: Users,
  trip_planning: Route,
  hospital_booking: Stethoscope,
  chinese_number_required: Hash,
  transfer: Plane,
  other: MoreHorizontal,
};

export const CATEGORY_LABEL: Record<ConciergeCategory, string> = {
  restaurant_reservation: "Reservation",
  scenic_tickets: "Tickets",
  virtual_queue: "Queue holding",
  trip_planning: "Trip planning",
  hospital_booking: "Hospital",
  chinese_number_required: "Assistance",
  transfer: "Transfer",
  other: "Booking",
};

export const categoryIcon = (c: string): LucideIcon =>
  CATEGORY_ICON[c as ConciergeCategory] ?? MoreHorizontal;

export const categoryLabel = (c: string): string =>
  CATEGORY_LABEL[c as ConciergeCategory] ?? "Booking";