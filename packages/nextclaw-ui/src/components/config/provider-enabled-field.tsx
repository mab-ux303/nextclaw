import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';

type ProviderEnabledFieldProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function ProviderEnabledField(props: ProviderEnabledFieldProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <Label className="text-sm font-medium text-gray-900">{t('enabled')}</Label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">{props.enabled ? t('enabled') : t('disabled')}</span>
        <Switch checked={props.enabled} onCheckedChange={props.onChange} />
      </div>
    </div>
  );
}
