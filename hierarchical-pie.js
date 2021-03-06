/** https://github.com/yhnavein/d3-hierarchical-pie/blob/master/hierarchical-pie.js
 *
 * Modified for use by KA.
*/
var $ = require("jquery");
var d3 = require("d3");

var HierarchicalPie = function(options) {
    var self = this;

    var config = {
        width             : 400,
        height            : 250,
        chartId           : null,
        data              : null,
        legendContainer   : null,
        hoverRadiusDiff   : 10,
        navigation        : null,
        hideNavOnRoot     : true,
        dataSchema        : {
            idField       : 'id_category',
            titleField    : 'category',  // Used for breadcrumbs
            valueField    : 'cost',
            childrenField : 'categories'
        },
        hoverPieAnimation : {
            easing   : "elastic",
            duration : 1000
        },
        focusAnimation : {
            easing   : "easeInOutQuart",
            duration : 100
        },
        rowTemplate: function(d) {
            /** Return a string html output for displaying a row in the chart
             */
            var output = '<td class="color-cell">' +
                '<span class="cat-color" style="background: ' + d.color +
                    '"></span>' +
                '</td>' +
                '<td>';
            if (d.isDirect) {
                output += '<span title="Directly in this category"' +
                   ' rel="tooltip"><i class="icon-info"></i></span>';
            }
            output += d.category + '</td>' +
                '<td class="cost">$' + d.cost + '</td>';
            return output;
        },
        mouseOverLabelTemplate: function(d) {
            var percentage = (
                ((d.endAngle - d.startAngle) / (2 * Math.PI)) * 100)
                .toFixed(1);
            return percentage + '%';
        },
        mouseOverSubLabelTemplate: function(d) {
            return "$" + d.data[config.dataSchema.valueField];
        }
    };

    $.extend(config, config, options || {});

    this.tweenPie = function(b){
        b.innerRadius = 0;
        var i = d3.interpolate({startAngle: 0, endAngle: 0}, b);
        return function(t) { return self.arc(i(t)); };
    };

    this.shadedTweenPie = function(b){
        b.innerRadius = 0;
        var i = d3.interpolate({startAngle: 0, endAngle: 0}, b);
        return function(t) { return self.shadedArc(i(t)); };
    };

    this.tabulateCategories = function (data) {
        var table = d3.select(config.legendContainer).select('table');
        table.select('tbody').remove();
        var tbody = table.append('tbody');
        // create a row for each object in the data
        var tableRows = tbody.selectAll("tr")
            .data(data)
            .enter()
                .append("tr")
                .attr('data_id', function(d) {
                    return d[config.dataSchema.idField];
                })
                .attr('class', function(d) {
                    return 'legend-row-' + d[config.dataSchema.idField];
                })
                .html(function(d) {
                    d.color = self.color(d[config.dataSchema.idField]);
                    d.isDirect = d[config.dataSchema.idField] == null;
                    return config.rowTemplate(d);
                })
                .on('click', self.selectChild);
        return table;
    };

    // chart width
    self.width  = config.width;
    self.height = config.height;
    // pie radius
    self.radius = Math.min(self.width, self.height) / 2;
    self.innerRadius = self.radius / 2;

    this.shadedRadius = function(d) {
        return (self.radius - self.innerRadius) *
            d.data[config.dataSchema.shadedPercentField] / 100 +
            self.innerRadius;
    };

    self.inLevel = 1;
    //data for each level of chart, to make navigation possible
    self.dataChain = [];

    this.init = function() {
        self.palette = d3.scale.ordinal()
            .range(['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                    '#8c564b', '#e377c2', '#7f7f7f', '#8f7540', '#bcbd22',
                    '#17becf', '#d7de85', '#754a5f', '#857c57', '#46a2b0',
                    '#ff9896']);
        self.color = function(id) {
            return id === null ? '#ddd' : self.palette(id);
        };

        self.svg = d3.select(config.chartId).append("svg")
            .attr('id', 'chart').attr("width", self.width)
            .attr("height", self.height)
            .append("g")
            .attr("transform", "translate(" + self.radius + "," +
                ((self.height / 2)) + ")");

        self.arc = d3.svg.arc()
            .outerRadius(self.radius - config.hoverRadiusDiff)
            .innerRadius(self.radius / 2);

        if (config.dataSchema.shadedPercentField) {
            self.shadedArc = d3.svg.arc()
                .outerRadius(self.radius - config.hoverRadiusDiff)
                .innerRadius(self.shadedRadius);

            self.svg
                .append('defs')
                .append('pattern')
                    .attr('id', 'diagonalHatch')
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 4)
                    .attr('height', 4)
                .append('path')
                    .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
                    .attr('stroke', '#000000')
                    .attr('stroke-width', 1);
        }

        self.arcOver = d3.svg.arc().outerRadius(self.radius)
            .innerRadius(self.radius / 2);
        self.pie     = d3.layout.pie().sort(null).value(function(d) {
            var val = d[config.dataSchema.valueField];
            if(typeof val === 'string')
                return parseFloat(val);

            return val;
        });


        self.focusGroup = self.svg.append('g').attr('class', 'focus-group');

        self.percentLabel = self.focusGroup.append('g')
            .attr('class', 'arc-percent').append("text");

        self.costLabel = self.focusGroup.append('g')
            .attr('class', 'arc-cost').append("text").attr("dy", "1.2em");

        self.navigation = $(config.navigation);
        self.navigation.find('#btnRoot').on('click', self.goToRoot);
        self.navigation.find('#btnLevelUp').on('click', self.goLevelUp);

        if(!config.hideNavOnRoot)
            self.navigation.show();
    };

    this.goToRoot = function() {
        self.inLevel = 1;
        self.dataChain.length = 0; //clear chain
        self.renderCake(config.data);

        if(config.hideNavOnRoot)
          self.navigation.hide();

        return false;
    };

    this.goLevelUp = function() {
        if(self.inLevel == 2 || self.dataChain.length == 0)
            return self.goToRoot();

        self.inLevel--;
        self.dataChain.splice(self.dataChain.length - 1, 1);
        var prev = self.dataChain[self.dataChain.length - 1];
        self.renderCake(prev[config.dataSchema.childrenField]);
        if(self.inLevel === 1 && config.hideNavOnRoot)
            self.navigation.hide();

        return false;
    };

    this.updateNav = function() {
        var breadcrumb = d3.select(config.navigation).select('.breadcrumb');
        breadcrumb.selectAll('li').remove();
        breadcrumb.selectAll('li')
            .data(self.dataChain)
            .enter()
            .append("li")
            .html(function(d, i) {
                return d[config.dataSchema.titleField] +
                    '<span class="divider">/</span>';
            });
    }

    this.selectChild = function (data) {
        if(typeof data[config.dataSchema.childrenField] === 'undefined')
            return false;

        self.inLevel++;
        self.dataChain.push( data );

        self.focusGroup.attr('opacity', 0);

        self.renderCake(data[config.dataSchema.childrenField]);
        if(self.inLevel > 1)
            self.navigation.show();

        return false;
    };

    this.pieClick = function (d, i) {
        var c = self.arc.centroid(d);
        self.selectChild(d.data);
        d3.select(this).attr("d", self.arc);
        return false;
    };

    this.pieMouseOut = function (d, i) {
        var hovered = d3.select(this);

        self.focusGroup.transition().attr('opacity', 0);

        if (!config.dataSchema.shadedPercentField) {
            //TODO(james): This does not work well with new shaded arcs.
            //Both the shaded arc and original one would have to expand.  I'm
            //not sure I actually like this effect though - so no big loss.
            hovered.transition().ease(config.focusAnimation.easing)
                .duration(config.focusAnimation.duration)
                .attr("d", self.arc);
        }

        d3.select(config.legendContainer)
            .select('.legend-row-' + d.data[config.dataSchema.idField])
            .selectAll('td')
            .classed("hovered", false);
    };

    this.pieMouseOver = function (d, i) {
        var hovered = d3.select(this);

        self.percentLabel.text(config.mouseOverLabelTemplate(d));
        self.costLabel.text(config.mouseOverSubLabelTemplate(d));
        self.focusGroup.transition().attr('opacity', 1);

        if (!config.dataSchema.shadedPercentField) {
            //TODO(james): This does not work well with new shaded arcs.
            //Both the shaded arc and original one would have to expand.  I'm
            //not sure I actually like this effect though - so no big loss.
            hovered.transition().ease(config.focusAnimation.easing)
                .duration(config.focusAnimation.duration)
                .attr("d", self.arcOver);
        }

        d3.select(config.legendContainer)
            .select('.legend-row-' + d.data[config.dataSchema.idField])
            .selectAll('td').classed("hovered", true);
    };

    this.renderCake = function(data) {
        self.updateNav();
        self.svg.selectAll('g.cake').remove();

        var arcs = self.svg.append('g').attr('class', 'cake')
            .selectAll("g.arc").data(self.pie(data))
            .enter().append("g")
            .attr("class", "arc");

        arcs.append("path").attr("d", self.arc)
            .attr("fill", function(d) {
                return self.color(d.data[config.dataSchema.idField]);
            })
            .attr("stroke", function(d) {
                return (d3.rgb(self.color(d.data[config.dataSchema.idField]))
                    .darker());
            })
            .attr('class', function(d) {
                return 'category-pie-' + d.data[config.dataSchema.idField] +
                    (typeof d.data[config.dataSchema.childrenField] ===
                     'undefined' ? ' pie-leaf' : '');
            })
            .on('mouseover', self.pieMouseOver)
            .on('mouseout', self.pieMouseOut)
            .on('click', self.pieClick)
            .transition().ease(config.hoverPieAnimation.easing)
            .duration(config.hoverPieAnimation.duration)
            .attrTween("d", self.tweenPie);

        if (config.dataSchema.shadedPercentField) {
            var shadedArcs = self.svg.append('g').attr('class', 'cake')
                .selectAll("g.arc").data(self.pie(data))
                .enter().append("g")
                .attr("class", "arc");

            shadedArcs.append("path").attr("d", self.shadedArc)
                .attr('fill', 'url(#diagonalHatch)')
                .attr('class', function(d) {
                    return 'category-pie-' + d.data[config.dataSchema.idField]
                        + (typeof d.data[config.dataSchema.childrenField] ===
                           'undefined' ? ' pie-leaf' : '');
                })
                .on('mouseover', self.pieMouseOver)
                .on('mouseout', self.pieMouseOut)
                .on('click', self.pieClick)
                .transition().ease(config.hoverPieAnimation.easing).duration(config.hoverPieAnimation.duration)
                .attrTween("d", self.shadedTweenPie);
        }

        self.tabulateCategories(data);
    };

    self.init();
    self.renderCake(config.data);
};

module.exports = HierarchicalPie;
