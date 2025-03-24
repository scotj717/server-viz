import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceDot, Label, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

// The "lodash" import remains in case you use it for deeper array manipulations
import _ from 'lodash';

const AdvancedServerOpportunityCostCalculator = () => {
  // Days & meal periods
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealPeriods = ['Lunch', 'Dinner'];

  // Initial server state
  const initialServerState = {
    name: '',
    wage: 4.74,
    phoneTimePercent: 15,  // % of shift on the phone
    tipPercent: 18,        // % tip servers typically earn
    hours: Array(7).fill().map(() => ({ lunch: 0, dinner: 0 }))
  };

  // ---------- STATE HOOKS ----------
  const [servers, setServers] = useState([{ ...initialServerState, name: 'Server 1' }]);
  const [checkSizes, setCheckSizes] = useState({
    lunch: Array(7).fill(25),   // default lunch check
    dinner: Array(7).fill(35)   // default dinner check
  });
  const [phoneTimePercent, setPhoneTimePercent] = useState(15);
  const [upsellValue, setUpsellValue] = useState(10);
  const [upsellMargin, setUpsellMargin] = useState(50);
  const [missedUpsellsPerHour] = useState(3); // read-only (best practice to remove setter if unused)
  const [slangAIReduction, setSlangAIReduction] = useState(70);
  const [tablesPerHour, setTablesPerHour] = useState(3);
  const [slangPlan, setSlangPlan] = useState(399);
  const [netProfitPercent, setNetProfitPercent] = useState(15);

  // Chart data states
  const [chartData, setChartData] = useState([]);
  const [impactData, setImpactData] = useState([]);
  const [serverImpactData, setServerImpactData] = useState([]);
  const [dayOfWeekData, setDayOfWeekData] = useState([]);

  // ---------- HELPERS ----------
  const formatCurrency = (value) => `$${value.toFixed(2)}`;

  // Weighted average phone time
  const calculateWeightedPhoneTime = useCallback(() => {
    if (!servers || servers.length === 0) return 15;

    // total hours across all servers
    const totalHours = servers.reduce((sum, server) => {
      return sum + server.hours.reduce((daySum, day) => daySum + (day.lunch || 0) + (day.dinner || 0), 0);
    }, 0);

    if (totalHours <= 0) return 15;

    // Weighted sum of phone times
    const weightedSum = servers.reduce((sum, server) => {
      const serverHours = server.hours.reduce((s, day) => s + (day.lunch || 0) + (day.dinner || 0), 0);
      return sum + ((server.phoneTimePercent || 15) * serverHours);
    }, 0);

    return Math.round(weightedSum / totalHours);
  }, [servers]);

  // ---------- SERVER ADD/REMOVE/UPDATE ----------
  const addServer = () => {
    setServers([...servers, { ...initialServerState, name: `Server ${servers.length + 1}` }]);
  };

  const removeServer = (index) => {
    if (servers.length > 1) {
      const newServers = [...servers];
      newServers.splice(index, 1);
      setServers(newServers);
    }
  };

  const updateServerName = (index, name) => {
    const newServers = [...servers];
    newServers[index].name = name;
    setServers(newServers);
  };

  const updateServerWage = (index, wage) => {
    const newServers = [...servers];
    newServers[index].wage = wage;
    setServers(newServers);
  };

  const updateServerTipPercent = (index, percent) => {
    const newServers = [...servers];
    newServers[index].tipPercent = percent;
    setServers(newServers);
  };

  const updateServerPhoneTime = (index, percent) => {
    const newServers = [...servers];
    newServers[index].phoneTimePercent = percent;
    setServers(newServers);
  };

  const updateServerHours = (serverIndex, dayIndex, mealPeriod, hours) => {
    const newServers = [...servers];
    newServers[serverIndex].hours[dayIndex][mealPeriod] = hours;
    setServers(newServers);
  };

  // ---------- CHECK SIZE UPDATE ----------
  const updateCheckSize = (mealPeriod, dayIndex, value) => {
    const newCheckSizes = { ...checkSizes };
    newCheckSizes[mealPeriod][dayIndex] = value;
    setCheckSizes(newCheckSizes);
  };

  // Whenever servers change, recalc weighted phone time
  useEffect(() => {
    const calcAvg = calculateWeightedPhoneTime();
    // only update if it differs significantly
    if (Math.abs(calcAvg - phoneTimePercent) > 1) {
      setPhoneTimePercent(calcAvg);
    }
  }, [servers, calculateWeightedPhoneTime, phoneTimePercent]);

  // ---------- MAIN CALCULATION EFFECT ----------
  useEffect(() => {
    if (!servers || servers.length === 0) return;

    const weeksPerMonth = 4.3;

    // For day-of-week breakdown
    const hoursByDayMeal = {
      lunch: Array(7).fill(0),
      dinner: Array(7).fill(0)
    };

    // Calculate total weekly hours
    let totalWeeklyHoursAll = 0;

    // 1) SERVER-BY-SERVER OPPORTUNITY COSTS
    const serverOpportunityCosts = servers.map((server) => {
      let serverWeeklyHours = 0;

      // sum up the server's weekly hours
      daysOfWeek.forEach((_, dayIndex) => {
        mealPeriods.forEach((mealPeriod) => {
          const hrs = server.hours[dayIndex][mealPeriod.toLowerCase()] || 0;
          if (hrs > 0) {
            serverWeeklyHours += hrs;
            hoursByDayMeal[mealPeriod.toLowerCase()][dayIndex] += hrs;
            totalWeeklyHoursAll += hrs;
          }
        });
      });

      // phone usage
      const phoneTimeDec = (server.phoneTimePercent || 15) / 100;
      const phoneHoursPerWeek = serverWeeklyHours * phoneTimeDec;
      const phoneHoursPerMonth = phoneHoursPerWeek * weeksPerMonth;

      // Direct labor cost
      const directLaborCost = phoneHoursPerMonth * (server.wage || 4.74);

      // Lost upsell & tips
      let lostUpsellProfit = 0;
      let lostTips = 0;
      const multitaskingFactor = 0.7;

      daysOfWeek.forEach((_, dayIndex) => {
        mealPeriods.forEach((mealPeriod) => {
          const hrs = server.hours[dayIndex][mealPeriod.toLowerCase()] || 0;
          if (hrs > 0) {
            const mealPhoneHours = hrs * phoneTimeDec * weeksPerMonth;
            const checkSize = checkSizes[mealPeriod.toLowerCase()][dayIndex] || 0;

            // lost upsell
            const missedUpsells = mealPhoneHours * missedUpsellsPerHour;
            const lostUpsellRevenue = missedUpsells * upsellValue;
            lostUpsellProfit += lostUpsellRevenue * (upsellMargin / 100);

            // lost tips
            const mealTablesNotServed = mealPhoneHours * tablesPerHour * multitaskingFactor;
            const mealLostCheckRevenue = mealTablesNotServed * checkSize;
            lostTips += mealLostCheckRevenue * ((server.tipPercent || 18) / 100);
          }
        });
      });

      // total opportunity cost
      const totalOpportunityCost = directLaborCost + lostUpsellProfit + lostTips;

      // with Slang.AI
      const reducedPhoneHoursPerMonth = phoneHoursPerMonth * (1 - slangAIReduction / 100);
      const reducedDirectLaborCost = reducedPhoneHoursPerMonth * (server.wage || 4.74);
      const reductionFactor = 1 - (slangAIReduction / 100);

      const reducedLostUpsellProfit = lostUpsellProfit * reductionFactor;
      const reducedLostTips = lostTips * reductionFactor;

      // each server's portion of subscription
      const serverShareOfSubscription =
        (serverWeeklyHours / Math.max(totalWeeklyHoursAll, 1)) * slangPlan;

      const withSlangAICost =
        reducedDirectLaborCost + reducedLostUpsellProfit + reducedLostTips + serverShareOfSubscription;

      return {
        name: server.name || 'Server',
        wage: server.wage || 4.74,
        weeklyHours: serverWeeklyHours,
        monthlyHours: serverWeeklyHours * weeksPerMonth,
        totalOpportunityCost,
        withSlangAICost,
        savings: totalOpportunityCost - withSlangAICost
      };
    });

    setServerImpactData(serverOpportunityCosts);

    // 2) BUILD PHONE TIME IMPACT CHART (5% to 25%)
    let totalWeeklyHours = 0;
    servers.forEach((s) => {
      s.hours.forEach((day) => {
        totalWeeklyHours += (day.lunch || 0) + (day.dinner || 0);
      });
    });

    const phoneTimePoints = [];
    for (let p = 5; p <= 25; p++) {
      phoneTimePoints.push(p);
    }

    const phoneTimeData = phoneTimePoints.map((percent) => {
      const dec = percent / 100;
      const phoneHoursPerWeek = totalWeeklyHours * dec;
      const phoneHoursPerMonth = phoneHoursPerWeek * weeksPerMonth;

      let totalDirectLaborCost = 0;
      let totalLostUpsellProfit = 0;
      let totalLostTips = 0;

      servers.forEach((server) => {
        const serverTotalHrs = server.hours.reduce((sum, d) => sum + (d.lunch || 0) + (d.dinner || 0), 0);
        const serverPhoneHrsPerMonth = serverTotalHrs * dec * weeksPerMonth;
        // direct labor
        totalDirectLaborCost += serverPhoneHrsPerMonth * (server.wage || 4.74);

        // lost upsell & tips
        daysOfWeek.forEach((_, dayIndex) => {
          mealPeriods.forEach((mealPeriod) => {
            const hrs = server.hours[dayIndex][mealPeriod.toLowerCase()] || 0;
            if (hrs > 0) {
              const mealPhoneHours = hrs * dec * weeksPerMonth;
              const checkSize = checkSizes[mealPeriod.toLowerCase()][dayIndex] || 0;
              const multitaskingFactor = 0.7;

              // lost upsell
              const missedUpsells = mealPhoneHours * missedUpsellsPerHour;
              totalLostUpsellProfit += (missedUpsells * upsellValue) * (upsellMargin / 100);

              // lost tips
              const mealTablesNotServed = mealPhoneHours * tablesPerHour * multitaskingFactor;
              const mealLostCheckRevenue = mealTablesNotServed * checkSize;
              totalLostTips += mealLostCheckRevenue * ((server.tipPercent || 18) / 100);
            }
          });
        });
      });

      const totalOpportunityCost = totalDirectLaborCost + totalLostUpsellProfit + totalLostTips;

      // with Slang.AI
      const reducedDirectLaborCost = totalDirectLaborCost * (1 - slangAIReduction / 100);
      const reducedLostUpsellProfit = totalLostUpsellProfit * (1 - slangAIReduction / 100);
      const reducedLostTips = totalLostTips * (1 - slangAIReduction / 100);
      const withSlangAICost = reducedDirectLaborCost + reducedLostUpsellProfit + reducedLostTips + slangPlan;
      const savings = totalOpportunityCost - withSlangAICost;

      return {
        phoneTimePercent: percent,
        withoutSlangAI: totalOpportunityCost,
        withSlangAI: withSlangAICost,
        savings,
        laborCost: totalDirectLaborCost,
        lostUpsellProfit: totalLostUpsellProfit,
        lostTips: totalLostTips
      };
    });

    setChartData(phoneTimeData);

    // find current data
    const currentData = phoneTimeData.find((d) => Math.abs(d.phoneTimePercent - phoneTimePercent) < 0.01);
    let newImpactData = [];
    if (currentData) {
      // positive impacts from phone calls
      const reservationsPerPhoneHour = 0.7;
      const avgReservationValue = 120;
      const conversionRate = 0.4;

      // total phone hours
      const totalPhoneHours = totalWeeklyHours * (phoneTimePercent / 100) * weeksPerMonth;

      // potential phone revenue
      const phoneRevenueGenerated = totalPhoneHours * reservationsPerPhoneHour * avgReservationValue * conversionRate;
      const phoneNetProfit = phoneRevenueGenerated * (netProfitPercent / 100);

      // assume 20% retention value
      const customerRetentionValue = phoneRevenueGenerated * 0.2;

      // partial concurrency for lost tips
      const multitaskingFactor = 0.7;
      const adjustedLostTips = currentData.lostTips * multitaskingFactor;

      // lost “customer-facing time” if on phone
      const lostCustomerTimeValue = totalPhoneHours * 15; // e.g., $15/hr “opportunity cost”

      // Net difference for Slang.AI
      const potentialReturn = currentData.withoutSlangAI - currentData.withSlangAI;

      newImpactData = [
        { name: 'Direct Labor Cost', value: currentData.laborCost, type: 'cost' },
        { name: 'Lost Upsell Profit', value: currentData.lostUpsellProfit, type: 'cost' },
        { name: 'Lost Server Tips', value: adjustedLostTips, type: 'cost' },
        // Re-labeled to show it is a cost
        { name: 'Lost Customer Time Value', value: lostCustomerTimeValue, type: 'cost' },

        { name: 'Phone Revenue Profit', value: phoneNetProfit, type: 'gain' },
        { name: 'Customer Retention', value: customerRetentionValue, type: 'gain' },
        // changed the label to reflect net difference rather than "ROI"
        { name: 'Slang.AI Net Impact', value: potentialReturn, type: 'gain' }
      ];
    }
    setImpactData(newImpactData);

    // 3) BUILD DAY-OF-WEEK IMPACT
    const dayImpacts = daysOfWeek.map((day, dayIndex) => {
      const lunchHours = hoursByDayMeal.lunch[dayIndex];
      const dinnerHours = hoursByDayMeal.dinner[dayIndex];
      const totalHours = lunchHours + dinnerHours;
      if (totalHours === 0) {
        return { name: day, value: 0, laborCost: 0, lostUpsellProfit: 0, lostTips: 0 };
      }

      let laborCost = 0;
      let lostUpsellProfit = 0;
      let lostTips = 0;

      servers.forEach((server) => {
        const serverLunch = server.hours[dayIndex].lunch || 0;
        const serverDinner = server.hours[dayIndex].dinner || 0;
        const serverDayHours = serverLunch + serverDinner;
        if (serverDayHours > 0) {
          const phoneTimeDec = (server.phoneTimePercent || 15) / 100;
          const serverPhoneHours = serverDayHours * phoneTimeDec * weeksPerMonth;
          laborCost += serverPhoneHours * (server.wage || 4.74);

          // lunch
          if (serverLunch > 0) {
            const lunchPhoneHrs = serverLunch * phoneTimeDec * weeksPerMonth;
            lostUpsellProfit += (lunchPhoneHrs * missedUpsellsPerHour * upsellValue) * (upsellMargin / 100);
            const multiFactor = 0.7;
            const lunchTablesNotServed = lunchPhoneHrs * tablesPerHour * multiFactor;
            const lunchLostCheckRevenue = lunchTablesNotServed * (checkSizes.lunch[dayIndex] || 0);
            lostTips += lunchLostCheckRevenue * ((server.tipPercent || 18) / 100);
          }

          // dinner
          if (serverDinner > 0) {
            const dinnerPhoneHrs = serverDinner * phoneTimeDec * weeksPerMonth;
            lostUpsellProfit += (dinnerPhoneHrs * missedUpsellsPerHour * upsellValue) * (upsellMargin / 100);
            const multiFactor = 0.7;
            const dinnerTablesNotServed = dinnerPhoneHrs * tablesPerHour * multiFactor;
            const dinnerLostCheckRevenue = dinnerTablesNotServed * (checkSizes.dinner[dayIndex] || 0);
            lostTips += dinnerLostCheckRevenue * ((server.tipPercent || 18) / 100);
          }
        }
      });

      const totalDayOpportunityCost = laborCost + lostUpsellProfit + lostTips;
      return {
        name: day,
        value: totalDayOpportunityCost,
        laborCost,
        lostUpsellProfit,
        lostTips
      };
    });

    setDayOfWeekData(dayImpacts);
  }, [
    servers,
    checkSizes,
    phoneTimePercent,
    upsellValue,
    upsellMargin,
    slangAIReduction,
    tablesPerHour,
    slangPlan,
    netProfitPercent // ensure no missing dependency warnings
  ]);

  // ---------- CURRENT VALUES ----------
  const currentPhoneTimeData = chartData.find(
    (d) => d && Math.abs(d.phoneTimePercent - phoneTimePercent) < 0.01
  );
  const currentWithoutSlangAI = currentPhoneTimeData?.withoutSlangAI || 0;
  const currentWithSlangAI = currentPhoneTimeData?.withSlangAI || 0;
  const currentSavings = currentPhoneTimeData?.savings || 0;

  // Annual calculations
  const annualSavings = currentSavings * 12;
  const annualSlangCost = slangPlan * 12;
  const roi = annualSlangCost > 0 ? (annualSavings / annualSlangCost) * 100 : 0;
  const paybackPeriod = currentSavings > 0 ? slangPlan / currentSavings : Infinity;

  // total hours across all servers
  const totalWeeklyHours = servers.reduce((sum, s) => {
    return sum + s.hours.reduce((sub, dd) => sub + (dd.lunch || 0) + (dd.dinner || 0), 0);
  }, 0);
  const weeksPerMonth = 4.3;
  const phoneHoursPerMonth = totalWeeklyHours * (phoneTimePercent / 100) * weeksPerMonth;
  const hoursReclaimed = phoneHoursPerMonth * (slangAIReduction / 100);

  // ---------- TOOLTIP COMPONENTS ----------
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-md">
          <p className="font-bold text-sm">{`Average Phone Time: ${label}%`}</p>
          <p className="text-blue-500">
            {`Without Slang.AI: ${formatCurrency(payload[0].value)}`}
          </p>
          <p className="text-green-500">
            {`With Slang.AI: ${formatCurrency(payload[1].value)}`}
          </p>
          <p className="text-purple-500">
            {`Monthly Savings: ${formatCurrency(payload[2].value)}`}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            The average phone time ({phoneTimePercent}%) is a weighted average based on each
            server’s individual phone time % and hours.
          </p>
        </div>
      );
    }
    return null;
  };

  const ServerTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const [withoutAI, withAI] = payload;
      return (
        <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-md">
          <p className="font-bold text-sm">{label}</p>
          <p className="text-blue-500">
            Without Slang.AI: {formatCurrency(withoutAI.value)}
          </p>
          <p className="text-green-500">
            With Slang.AI: {formatCurrency(withAI.value)}
          </p>
          <p className="text-purple-500">
            Monthly Savings: {formatCurrency(withoutAI.value - withAI.value)}
          </p>
          <p className="text-gray-500 text-xs mt-2">Monthly opportunity cost</p>
        </div>
      );
    }
    return null;
  };

  // ---------- RENDER ----------
  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Advanced Server Opportunity Cost Calculator
      </h1>

      {/* ---------- SERVER CONFIGURATION ---------- */}
      <div className="bg-gray-50 p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Server Configuration</h2>
        <div className="mb-4 flex justify-end">
          <button
            onClick={addServer}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
          >
            Add Server
          </button>
          {servers.length > 1 && (
            <button
              onClick={() => removeServer(servers.length - 1)}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Remove Server
            </button>
          )}
        </div>

        {servers.map((server, sIndex) => (
          <div key={sIndex} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex flex-wrap items-center mb-4">
              {/* Server Name */}
              <div className="w-full md:w-1/4 mb-2 md:mb-0 pr-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  value={server.name}
                  onChange={(e) => updateServerName(sIndex, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Server Name"
                />
              </div>

              {/* Base Wage */}
              <div className="w-full md:w-1/4 mb-2 md:mb-0 px-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Wage ($/hour)
                </label>
                <div className="flex items-center">
                  <span className="text-sm mr-1">$</span>
                  <input
                    type="number"
                    min="2.13"
                    max="15"
                    step="0.01"
                    value={server.wage}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(parseFloat(val)))) {
                        updateServerWage(sIndex, val === '' ? '' : parseFloat(val));
                      }
                    }}
                    onBlur={() => {
                      if (server.wage === '' || isNaN(server.wage)) {
                        updateServerWage(sIndex, 4.74);
                      } else {
                        updateServerWage(
                          sIndex,
                          Math.max(2.13, Math.min(15, server.wage))
                        );
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {/* Phone Time (%) */}
              <div className="w-full md:w-1/4 mb-2 md:mb-0 px-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Time (%)
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    value={server.phoneTimePercent}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(parseFloat(val)))) {
                        updateServerPhoneTime(sIndex, val === '' ? '' : parseFloat(val));
                      }
                    }}
                    onBlur={() => {
                      if (
                        server.phoneTimePercent === '' ||
                        isNaN(server.phoneTimePercent)
                      ) {
                        updateServerPhoneTime(sIndex, 15);
                      } else {
                        updateServerPhoneTime(
                          sIndex,
                          Math.max(0, Math.min(50, server.phoneTimePercent))
                        );
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="text-sm ml-1">%</span>
                </div>
              </div>

              {/* Tip Percentage (%) */}
              <div className="w-full md:w-1/4 mb-2 md:mb-0 pl-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tip Percentage (%)
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    value={server.tipPercent}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(parseFloat(val)))) {
                        updateServerTipPercent(sIndex, val === '' ? '' : parseFloat(val));
                      }
                    }}
                    onBlur={() => {
                      if (
                        server.tipPercent === '' ||
                        isNaN(server.tipPercent)
                      ) {
                        updateServerTipPercent(sIndex, 18);
                      } else {
                        updateServerTipPercent(
                          sIndex,
                          Math.max(0, Math.min(30, server.tipPercent))
                        );
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="text-sm ml-1">%</span>
                </div>
              </div>
            </div>

            <h3 className="text-md font-medium mb-3">Weekly Hours</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1"></th>
                    {daysOfWeek.map((day) => (
                      <th key={day} className="border border-gray-300 px-2 py-1 text-sm">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mealPeriods.map((mealPeriod) => (
                    <tr key={mealPeriod}>
                      <td className="border border-gray-300 px-2 py-1 font-medium text-sm">
                        {mealPeriod}
                      </td>
                      {server.hours.map((dayHours, dayIndex) => (
                        <td key={dayIndex} className="border border-gray-300 px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            max="12"
                            step="0.5"
                            value={dayHours[mealPeriod.toLowerCase()]}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (
                                val === '' ||
                                (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)
                              ) {
                                updateServerHours(
                                  sIndex,
                                  dayIndex,
                                  mealPeriod.toLowerCase(),
                                  val === '' ? '' : parseFloat(val)
                                );
                              }
                            }}
                            onBlur={() => {
                              const val =
                                server.hours[dayIndex][mealPeriod.toLowerCase()];
                              if (val === '' || isNaN(val)) {
                                updateServerHours(sIndex, dayIndex, mealPeriod.toLowerCase(), 0);
                              } else {
                                updateServerHours(
                                  sIndex,
                                  dayIndex,
                                  mealPeriod.toLowerCase(),
                                  Math.max(0, Math.min(12, val))
                                );
                              }
                            }}
                            className="w-14 px-1 py-1 border border-gray-300 rounded-md text-sm"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- AVERAGE CHECK SIZE CONFIG ---------- */}
      <div className="bg-gray-50 p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">
          Average Check Size by Day &amp; Meal Period ($)
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1"></th>
                {daysOfWeek.map((day) => (
                  <th key={day} className="border border-gray-300 px-2 py-1 text-sm">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mealPeriods.map((mealPeriod) => (
                <tr key={mealPeriod}>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-sm">
                    {mealPeriod}
                  </td>
                  {checkSizes[mealPeriod.toLowerCase()].map((checkSize, dayIndex) => (
                    <td key={dayIndex} className="border border-gray-300 px-1 py-1">
                      <div className="flex items-center">
                        <span className="text-xs mr-1">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={checkSize}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (
                              val === '' ||
                              (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)
                            ) {
                              updateCheckSize(mealPeriod.toLowerCase(), dayIndex, parseFloat(val));
                            }
                          }}
                          onBlur={() => {
                            const val = checkSizes[mealPeriod.toLowerCase()][dayIndex];
                            if (isNaN(val)) {
                              updateCheckSize(mealPeriod.toLowerCase(), dayIndex, 0);
                            } else {
                              updateCheckSize(mealPeriod.toLowerCase(), dayIndex, Math.max(0, val));
                            }
                          }}
                          className="w-16 px-1 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- SERVICE METRICS & SLANG.AI SETTINGS ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* LEFT: Service & Revenue */}
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Service &amp; Revenue Metrics</h2>
          {/* Tables/Hour */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tables Served per Hour
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={tablesPerHour}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                  setTablesPerHour(parseFloat(val));
                }
              }}
              onBlur={() => {
                if (tablesPerHour === '' || isNaN(tablesPerHour)) {
                  setTablesPerHour(0);
                } else {
                  setTablesPerHour(Math.max(0, tablesPerHour));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Upsell Value */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upsell Value per Item ($)
            </label>
            <div className="flex items-center">
              <span className="text-sm mr-1">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsellValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                    setUpsellValue(parseFloat(val));
                  }
                }}
                onBlur={() => {
                  if (isNaN(upsellValue)) {
                    setUpsellValue(0);
                  } else {
                    setUpsellValue(Math.max(0, upsellValue));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Upsell Margin */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profit Margin on Upsells (%)
            </label>
            <div className="flex items-center">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={upsellMargin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                    setUpsellMargin(parseFloat(val));
                  }
                }}
                onBlur={() => {
                  if (isNaN(upsellMargin)) {
                    setUpsellMargin(0);
                  } else {
                    setUpsellMargin(Math.max(0, Math.min(100, upsellMargin)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <span className="text-sm ml-1">%</span>
            </div>
          </div>

          {/* Net Profit % */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Net Profit Percentage (%)
            </label>
            <div className="flex items-center">
              <input
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={netProfitPercent}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                    setNetProfitPercent(parseFloat(val));
                  }
                }}
                onBlur={() => {
                  if (isNaN(netProfitPercent)) {
                    setNetProfitPercent(0);
                  } else {
                    setNetProfitPercent(Math.max(0, Math.min(50, netProfitPercent)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <span className="text-sm ml-1">%</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Slang.AI Settings */}
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Slang.AI Settings</h2>

          {/* Slang.AI reduction slider */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Calls Handled by Slang.AI (%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={slangAIReduction}
              onChange={(e) => setSlangAIReduction(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>{slangAIReduction}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Slang.AI plan */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slang.AI Plan
            </label>
            <select
              value={slangPlan}
              onChange={(e) => setSlangPlan(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="0">No Subscription ($0.00)</option>
              <option value="399">Core Plan ($399.00)</option>
              <option value="599">Premium Plan ($599.00)</option>
            </select>
          </div>

          {/* OPPORTUNITY vs. GAIN ANALYSIS */}
          <div className="bg-white p-3 rounded border border-gray-200 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Opportunity vs. Gain Analysis
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={impactData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    // Show the name, $value, and percent
                    label={({ name, value, percent }) =>
                      `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {impactData.map((entry, idx) => {
                      const isGain = entry.type === 'gain';
                      return (
                        <Cell
                          key={`cell-${idx}`}
                          fill={isGain ? '#4ade80' : '#ef4444'} // green for gain, red for cost
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [
                      formatCurrency(val),
                      `${name} ${
                        val > 0
                          ? `(${((val / (currentWithoutSlangAI + 0.01)) * 100).toFixed(1)}% of total cost)`
                          : ''
                      }`
                    ]}
                  />
                  <Legend
                    formatter={(val) => {
                      const item = impactData.find((x) => x.name === val);
                      if (!item) return val;
                      return `${val} (${item.type === 'gain' ? 'Gain' : 'Cost'})`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              <p>Red segments: Costs/Opportunity Losses | Green segments: Gains/Benefits</p>
              <p>
                ROI: {roi.toFixed(0)}% | Net Profit Rate: {netProfitPercent}% | Slang.AI Monthly
                Impact: {formatCurrency(currentSavings)}
              </p>
            </div>
          </div>

          {/* DAY OF WEEK IMPACT */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Day of Week Impact</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#82ca9d" name="Opportunity Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- RESULTS SUMMARY ---------- */}
      <div className="mb-8 bg-blue-50 p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">
          Cost Summary at {phoneTimePercent}% Average Phone Time
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Monthly Opportunity Cost */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Monthly Opportunity Cost</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(currentWithoutSlangAI)}
            </p>
            <p className="text-xs text-gray-500">Without Slang.AI</p>
          </div>

          {/* Monthly Cost with Slang.AI */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Monthly Cost</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(currentWithSlangAI)}
            </p>
            <p className="text-xs text-gray-500">With Slang.AI</p>
          </div>

          {/* Monthly Savings */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Monthly Savings</h3>
            <p
              className={`text-2xl font-bold ${
                currentSavings >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {currentSavings >= 0 ? '+' : ''}
              {formatCurrency(currentSavings)}
            </p>
            <p className="text-xs text-gray-500">Using Slang.AI</p>
          </div>

          {/* Server Hours Reclaimed */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Server Hours Reclaimed</h3>
            <p className="text-2xl font-bold text-blue-600">{hoursReclaimed.toFixed(1)}</p>
            <p className="text-xs text-gray-500">Hours/month back to table service</p>
          </div>
        </div>

        {/* Advanced Metrics */}
        <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">Advanced Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Annual Savings */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-xs font-medium text-gray-700">Annual Savings</h3>
            <p
              className={`text-lg font-bold ${
                annualSavings >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {annualSavings >= 0 ? '+' : ''}
              {formatCurrency(annualSavings)}
            </p>
            <p className="text-xs text-gray-500">Projected yearly impact</p>
          </div>

          {/* ROI */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-xs font-medium text-gray-700">ROI</h3>
            <p
              className={`text-lg font-bold ${
                roi >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {roi.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">Annual return on investment</p>
          </div>

          {/* Payback Period */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-xs font-medium text-gray-700">Payback Period</h3>
            <p className="text-lg font-bold text-blue-600">
              {paybackPeriod === Infinity
                ? 'N/A'
                : paybackPeriod <= 0
                ? 'Immediate'
                : paybackPeriod <= 1
                ? '< 1 month'
                : `${paybackPeriod.toFixed(1)} months`}
            </p>
            <p className="text-xs text-gray-500">Time to recover investment</p>
          </div>
        </div>
      </div>

      {/* ---------- SERVER IMPACT CHART ---------- */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 h-96">
        <h3 className="text-md font-medium mb-3">
          Individual Server Impact (Based on Each Server&apos;s Phone Time %)
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={serverImpactData}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip content={<ServerTooltip />} />
            <Legend verticalAlign="top" />
            <Bar dataKey="totalOpportunityCost" name="Without Slang.AI" fill="#3b82f6" />
            <Bar dataKey="withSlangAICost" name="With Slang.AI" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ---------- PHONE TIME IMPACT CHART ---------- */}
      <div className="bg-white p-4 rounded-lg shadow h-96 mb-6">
        <h3 className="text-md font-medium mb-3">Average Phone Time Impact Chart</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="phoneTimePercent"
              label={{ value: 'Average Phone Time (%)', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Monthly Cost ($)', angle: -90, position: 'insideLeft' }}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="withoutSlangAI"
              name="Opportunity Cost Without Slang.AI"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="withSlangAI"
              name="Cost With Slang.AI"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="savings"
              name="Monthly Savings"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            {phoneTimePercent && (
              <ReferenceDot
                x={phoneTimePercent}
                y={currentWithoutSlangAI}
                r={6}
                fill="red"
                stroke="none"
              >
                <Label
                  value={`Current: ${phoneTimePercent}%`}
                  position="top"
                  fill="red"
                  fontSize={12}
                  fontWeight="bold"
                />
              </ReferenceDot>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ---------- FOOTER NOTE ---------- */}
      <div className="mt-4 text-sm text-gray-500">
        <p>
          Note: This advanced calculator provides a detailed analysis of the costs and benefits when
          servers spend time on phone duties. The calculations now include a comprehensive balance
          of both opportunity costs and potential gains, with ROI and net profit metrics to help you
          make data-driven decisions.
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Direct labor costs when servers are on phones</li>
          <li>Realistic lost upsell opportunities (adjusted for multitasking)</li>
          <li>Accurate lost tip calculations that recognize partial concurrency</li>
          <li>The value of customer-facing time that could be reclaimed</li>
          <li>Positive net profit from successful phone calls/reservations</li>
          <li>Customer retention value from well-handled phone interactions</li>
          <li>Slang.AI net impact based on monthly subscription cost vs. potential savings</li>
        </ul>
        <p className="mt-2">
          The pie chart shows both costs (red) and gains (green) to provide a balanced view of phone
          duties&apos; financial impact, while factoring in your restaurant&apos;s net profit
          percentage for greater accuracy.
        </p>
      </div>
    </div>
  );
};

export default AdvancedServerOpportunityCostCalculator;
