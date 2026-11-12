"use client";
import { useActionState } from "react";
import { AddScheduleDialog } from "@/components/activities/add-schedule-dialog";
import { cancelPickupAppointment } from "@/app/pickups/actions";
import type { MonthlyPickupItem } from "./monthly-pickup-panel";
export function PickupAppointmentActions({ departments, defaultDate, item }: { departments: { id: string; name: string }[]; defaultDate: string; item: MonthlyPickupItem }) {
  const [state, action, pending] = useActionState(cancelPickupAppointment, {});
  return <div className="space-y-2"><AddScheduleDialog departments={departments} defaultDate={defaultDate} trigger="pickup" pickupId={item.id} defaultProduct={item.product} defaultCustomerType={item.customerType} defaultCustomer={{ id: item.customerId, name: item.customerName, phone: item.customerPhone, address: item.customerAddress, departmentId: item.departmentId }}/>{item.appointmentIds.map((id, index) => <form key={id} action={action}><input name="id" type="hidden" value={id}/><input name="pickupId" type="hidden" value={item.id}/><button disabled={pending} className="text-xs font-bold text-red-600">アポ解除{item.appointmentIds.length > 1 ? `（${index + 1}）` : ""}</button></form>)}{state.message && <p role="status" className="text-xs text-slate-600">{state.message}</p>}</div>;
}
