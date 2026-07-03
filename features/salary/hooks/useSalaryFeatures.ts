import { useMemo } from 'react';
import { useSalaryFeatureAccess } from './useSalaryFeatureAccess';

export function useSalaryFeatures() {
  const advancePayments = useSalaryFeatureAccess('advancePayments');
  const splitPayments = useSalaryFeatureAccess('splitPayments');
  const adjustmentsView = useSalaryFeatureAccess('adjustmentsView');
  const adjustmentsCreate = useSalaryFeatureAccess('adjustmentsCreate');
  const adjustmentsReverse = useSalaryFeatureAccess('adjustmentsReverse');
  const commissionTracking = useSalaryFeatureAccess('commissionTracking');
  const proofAttachments = useSalaryFeatureAccess('proofAttachments');
  const hourlySalary = useSalaryFeatureAccess('hourlySalary');
  const bankDetails = useSalaryFeatureAccess('bankDetails');
  const attendanceBasedPay = useSalaryFeatureAccess('attendanceBasedPay');
  const editSalary = useSalaryFeatureAccess('editSalary');
  const exportData = useSalaryFeatureAccess('exportData');
  const bulkPayments = useSalaryFeatureAccess('bulkPayments');
  const salaryComponents = useSalaryFeatureAccess('salaryComponents');
  const payslipGeneration = useSalaryFeatureAccess('payslipGeneration');
  const statutoryCompliance = useSalaryFeatureAccess('statutoryCompliance');
  const statutoryTds = useSalaryFeatureAccess('statutoryTds');
  const complianceExports = useSalaryFeatureAccess('complianceExports');
  const form16Generation = useSalaryFeatureAccess('form16Generation');
  const payslipEmail = useSalaryFeatureAccess('payslipEmail');
  const gratuityTracking = useSalaryFeatureAccess('gratuityTracking');
  const lwfTracking = useSalaryFeatureAccess('lwfTracking');
  const tdsManagement = useSalaryFeatureAccess('tdsManagement');
  const fnfSettlement = useSalaryFeatureAccess('fnfSettlement');
  const autoGenerate = useSalaryFeatureAccess('autoGenerate');
  const salaryRevisions = useSalaryFeatureAccess('salaryRevisions');
  const salaryIncrements = useSalaryFeatureAccess('salaryIncrements');
  const reversePayment = useSalaryFeatureAccess('reversePayment');
  const loanManagement = useSalaryFeatureAccess('loanManagement');
  const bonusTracking = useSalaryFeatureAccess('bonusTracking');
  const dailyWageLedger = useSalaryFeatureAccess('dailyWageLedger');

  // Wrap in useMemo so the outer object identity is stable when none of the
  // inner FeatureAccessResult references change. Each inner result is
  // already memoized inside `useSalaryFeatureAccess`, so this makes the whole
  // hook return a stable reference across renders unless an actual access
  // flag flips.
  return useMemo(
    () => ({
      advancePayments,
      splitPayments,
      adjustmentsView,
      adjustmentsCreate,
      adjustmentsReverse,
      commissionTracking,
      proofAttachments,
      hourlySalary,
      bankDetails,
      attendanceBasedPay,
      editSalary,
      exportData,
      bulkPayments,
      salaryComponents,
      payslipGeneration,
      statutoryCompliance,
      statutoryTds,
      complianceExports,
      form16Generation,
      payslipEmail,
      gratuityTracking,
      lwfTracking,
      tdsManagement,
      fnfSettlement,
      autoGenerate,
      salaryRevisions,
      salaryIncrements,
      reversePayment,
      loanManagement,
      bonusTracking,
      dailyWageLedger,
    }),
    [
      advancePayments,
      splitPayments,
      adjustmentsView,
      adjustmentsCreate,
      adjustmentsReverse,
      commissionTracking,
      proofAttachments,
      hourlySalary,
      bankDetails,
      attendanceBasedPay,
      editSalary,
      exportData,
      bulkPayments,
      salaryComponents,
      payslipGeneration,
      statutoryCompliance,
      statutoryTds,
      complianceExports,
      form16Generation,
      payslipEmail,
      gratuityTracking,
      lwfTracking,
      tdsManagement,
      fnfSettlement,
      autoGenerate,
      salaryRevisions,
      salaryIncrements,
      reversePayment,
      loanManagement,
      bonusTracking,
      dailyWageLedger,
    ],
  );
}
