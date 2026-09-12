package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class BatchPointsResponse {

    private java.util.Map<String, List<PointItem>> obligations;

    public java.util.Map<String, List<PointItem>> getObligations() { return obligations; }
    public void setObligations(java.util.Map<String, List<PointItem>> obligations) { this.obligations = obligations; }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PointItem {
        private String marker;
        private String text;
        private Integer level;
        private List<PointItem> children;

        public String getMarker() { return marker; }
        public void setMarker(String marker) { this.marker = marker; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        public Integer getLevel() { return level; }
        public void setLevel(Integer level) { this.level = level; }
        public List<PointItem> getChildren() { return children; }
        public void setChildren(List<PointItem> children) { this.children = children; }
    }
}
