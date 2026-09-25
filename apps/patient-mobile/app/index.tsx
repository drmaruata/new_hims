import { Text, View } from "react-native";

export default function PatientHome() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>HIMS Patient</Text>
      <Text style={{ marginTop: 8, textAlign: "center" }}>Appointments, reports, prescriptions, bills and patient engagement.</Text>
    </View>
  );
}
