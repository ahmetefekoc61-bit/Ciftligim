import { router, useLocalSearchParams } from 'expo-router';
import { TreatmentForm } from '@/components/TreatmentForm';
import { Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useFarmId } from '@/lib/session';

export default function Tedavi() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const farmId = useFarmId();
  return (
    <Screen>
      <TreatmentForm
        submitLabel="Kaydet"
        onSubmit={async (req) => {
          try {
            await api.post(`/api/farms/${farmId}/animals/${animalId}/treatments`, req);
            router.back();
          } catch (e) {
            throw new Error(errorMessage(e));
          }
        }}
      />
    </Screen>
  );
}
