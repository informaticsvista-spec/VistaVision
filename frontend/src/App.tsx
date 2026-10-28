import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Activities from "./pages/Activities";
import DataVisualization from "./pages/DataVisualization";
import Home from "./pages/Home";
import Recognition, { RecognitionHub } from "./pages/Recognition";
import Report from "./pages/Report";
import SettingsPage from "./pages/SettingsPage";
import FaceTool from "./pages/recognition/FaceTool";
import NumberTool from "./pages/recognition/NumberTool";
import ObjectTool from "./pages/recognition/ObjectTool";
import UploadTool from "./pages/recognition/UploadTool";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="recognition" element={<Recognition />}>
          <Route index element={<RecognitionHub />} />
          <Route path="faces" element={<FaceTool />} />
          <Route path="numbers" element={<NumberTool />} />
          <Route path="objects" element={<ObjectTool />} />
          <Route path="upload" element={<UploadTool />} />
        </Route>
        <Route path="data" element={<DataVisualization />} />
        <Route path="activities" element={<Activities />} />
        <Route path="report" element={<Report />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
