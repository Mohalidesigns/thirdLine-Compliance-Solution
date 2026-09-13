package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class BatchPointsResponse {

    private Map<String, ObligationPoints> obligations;

    public Map<String, ObligationPoints> getObligations() { return obligations; }
    public void setObligations(Map<String, ObligationPoints> obligations) { this.obligations = obligations; }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ObligationPoints {
        private List<PointItem> verbatim;
        private List<PointItem> interpreted;

        public List<PointItem> getVerbatim() { return verbatim; }
        public void setVerbatim(List<PointItem> verbatim) { this.verbatim = verbatim; }
        public List<PointItem> getInterpreted() { return interpreted; }
        public void setInterpreted(List<PointItem> interpreted) { this.interpreted = interpreted; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PointItem {
        private String marker;
        private String text;
        private Integer level;
        private List<PointItem> children;

        public String getMarker() { return marker; }
        public void setMarker(String marker) { if (marker == null) { this.marker = null; return; } String cleaned = marker.replaceAll("[()\\s]", "").trim(); this.marker = cleaned.isEmpty() ? null : cleaned; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        public Integer getLevel() { return level; }
        public void setLevel(Integer level) { this.level = level; }
        public List<PointItem> getChildren() { return children; }
        public void setChildren(List<PointItem> children) { this.children = children; }
    }
}
