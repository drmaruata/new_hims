import { Text, View } from 'react-native';

export default function ClinicianHome() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>HIMS Clinician</Text>
      <Text style={{ marginTop: 8, textAlign: 'center' }}>
        Mobile access for schedules, patients, results, tasks and alerts.
      </Text>
    </View>
  );
}
