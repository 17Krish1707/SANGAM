import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, CheckCircle2, ArrowRight } from 'lucide-react';

export interface PageGuideProps {
  pageTitle: string;
  purpose: string;
  inputs?: string[];
  outputs?: string[];
  nextStep?: { label: string; to?: string };
}

export const PageGuideBanner: React.FC<PageGuideProps> = ({
  pageTitle,
  purpose,
  inputs,
  outputs,
  nextStep,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-xs overflow-hidden mb-5">
      <div className="px-4 py-2.5 flex items-center justify-between bg-[#F6F8FB] border-b border-[#D9E1EA]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#173F7A]/10 flex items-center justify-center text-[#173F7A]">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-[#172033]">
            What do I do here?
          </span>
          <span className="text-[11px] text-[#667085] hidden sm:inline">
            — {pageTitle} Operational Workflow Guide
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-xs font-medium text-[#173F7A] hover:text-[#1E4E8C] px-2 py-0.5 rounded hover:bg-white transition-colors"
          title="Toggle page instructions"
        >
          <span>{isOpen ? 'Hide Guide' : 'Show Instructions'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-4 bg-white text-xs space-y-3 animate-in fade-in duration-150">
          <p className="text-[#172033] font-normal leading-relaxed">
            {purpose}
          </p>

          {(inputs || outputs) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              {inputs && inputs.length > 0 && (
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-slate-200">
                  <div className="font-semibold text-[#173F7A] mb-1.5 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#173F7A]"></span>
                    Required Inputs
                  </div>
                  <ul className="space-y-1 text-slate-600">
                    {inputs.map((inp, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-slate-400">•</span>
                        <span>{inp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {outputs && outputs.length > 0 && (
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-slate-200">
                  <div className="font-semibold text-emerald-700 mb-1.5 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Expected Outcomes
                  </div>
                  <ul className="space-y-1 text-slate-600">
                    {outputs.map((out, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500">•</span>
                        <span>{out}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {nextStep && (
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
              <span className="font-medium">Recommended Next Step:</span>
              <span className="font-semibold text-[#173F7A] flex items-center gap-1">
                {nextStep.label}
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
